import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { requireSession } from '@/lib/auth'
import prisma from '@/lib/db'
import { payFromEscrow, EscrowConfigError } from '@/lib/escrow-wallet'
import { notify, TABS } from '@/lib/notifications'

// Withdrawing a funded posting signs a real refund — @nimiq/core is
// WebAssembly and needs the Node runtime, not edge.
export const runtime = 'nodejs'
export const maxDuration = 60
import { isPlatformAdmin } from '@/lib/admin'
import {
  isValidCategory,
  sanitizeAttachments,
  sanitizeDeliverables,
} from '@/lib/opportunities'

// One detail endpoint serves three readers, and each sees a different slice:
//
//   the client   everything, including every proposal
//   a freelancer the public posting plus their own proposal
//   a bystander  the public posting only, and only while it is open
//
// Chat and work submissions are never in a bystander's payload — they are
// dispute evidence between two named parties.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const user = await requireSession(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const opportunity = await prisma.agreement.findUnique({
      where: { id },
      include: {
        buyer: { select: { id: true, address: true, displayName: true } },
        seller: { select: { id: true, address: true, displayName: true } },
        escrowTransactions: { orderBy: { createdAt: 'desc' } },
        disputes: {
          select: { id: true, status: true, createdAt: true, humanRequestedAt: true },
        },
        proposals: {
          include: {
            freelancer: {
              select: {
                id: true,
                address: true,
                displayName: true,
                reputationScores: { select: { trustScore: true, completedAgreements: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        messages: {
          include: { sender: { select: { id: true, displayName: true } } },
          orderBy: { createdAt: 'asc' },
          take: 200,
        },
      },
    })

    if (!opportunity) {
      return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 })
    }

    const isClient = opportunity.buyerId === user.userId
    const isFreelancer = opportunity.sellerId === user.userId
    const isParty = isClient || isFreelancer

    // A platform mediator can read a deal they have been asked to rule on, and
    // only such a deal. Ruling on a case without seeing the deliverables, the
    // submitted work and the chat would be ruling on nothing — but that is an
    // argument for access to *this* deal, not to the platform's private
    // postings at large, so it is scoped to a dispute someone actually referred
    // to a human and that is still open.
    const me = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { address: true },
    })
    const referredForMediation = opportunity.disputes.some(
      (d) => d.humanRequestedAt !== null && d.status !== 'resolved',
    )
    const isMediator = !isParty && isPlatformAdmin(me?.address) && referredForMediation

    // A draft is nobody's business but its author's, and once a freelancer is
    // engaged the posting leaves the public board with them.
    if (!isParty && !isMediator && opportunity.status !== 'open') {
      return NextResponse.json({ error: 'Not visible' }, { status: 403 })
    }

    // The pre-image is the spending key to the HTLC. It leaves the server for
    // exactly one reader — the freelancer, after approval — and does so through
    // the claim route, never in a page payload.
    const { proposals, messages, htlcPreImage, ...rest } = opportunity

    return NextResponse.json({
      ...rest,
      preImageAvailable: Boolean(htlcPreImage) && opportunity.status === 'completed' && isFreelancer,
      viewer: {
        id: user.userId,
        isClient,
        isFreelancer,
        isParty,
        // Read-only. A mediator is deliberately not a party: they can see
        // everything the case turns on and act on none of it, because
        // submitting work or approving it is not what they were asked to do.
        isMediator,
      },
      proposals: isClient
        ? proposals
        : proposals.filter((p) => p.freelancerId === user.userId),
      proposalCount: proposals.length,
      // The chat is evidence. A mediator asked to rule on the case reads it for
      // the same reason the AI mediator is given it.
      messages: isParty || isMediator ? messages : [],
    })
  } catch (error) {
    console.error('Get opportunity error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Edit a posting, or withdraw it. Both are the client's alone, and both stop
// being possible the moment a freelancer is on the hook: the terms a proposal
// was written against cannot be rewritten underneath it.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const user = await requireSession(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const opportunity = await prisma.agreement.findUnique({
      where: { id },
      include: { buyer: { select: { address: true } } },
    })
    if (!opportunity) {
      return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 })
    }
    if (opportunity.buyerId !== user.userId) {
      return NextResponse.json({ error: 'Only the client can edit this posting' }, { status: 403 })
    }

    const body = await request.json()

    if (body.status === 'cancelled') {
      if (opportunity.status !== 'draft' && opportunity.status !== 'open') {
        return NextResponse.json(
          { error: 'A posting cannot be withdrawn once a freelancer is engaged' },
          { status: 400 },
        )
      }

      // A draft never cost anything. A published posting did: the budget left
      // the client's wallet at funding, so withdrawing has to send it back.
      // Marking the row cancelled without returning the money would strand it
      // in the escrow wallet with nothing left pointing at it.
      const funded = await prisma.escrowTransaction.findFirst({
        where: { agreementId: id, type: 'fund' },
      })
      const refundNIM = funded ? Number(opportunity.amountNIM) : 0

      let refund: { amountNIM: number; txHash: string } | null = null
      if (refundNIM > 0) {
        const outcome = await refundWithdrawnBudget({
          agreementId: id,
          amountNIM: refundNIM,
          clientAddress: opportunity.buyer.address,
        })
        // The posting stays exactly as it was if the money could not go back.
        // A cancelled posting whose escrow is still held is strictly worse
        // than a live one the client can try to withdraw again.
        if (!outcome.ok) {
          return NextResponse.json(
            { error: outcome.error, detail: outcome.detail },
            { status: outcome.status },
          )
        }
        refund = { amountNIM: refundNIM, txHash: outcome.txHash }
      }

      const cancelled = await prisma.agreement.update({
        where: { id },
        data: { status: 'cancelled' },
      })
      const { count: declined } = await prisma.proposal.updateMany({
        where: { agreementId: id, status: 'pending' },
        data: { status: 'rejected' },
      })

      // Anyone who wrote a proposal against this spent real effort on it and
      // is owed the news directly, not a posting that quietly disappears.
      const pitched = await prisma.proposal.findMany({
        where: { agreementId: id, status: 'rejected' },
        select: { freelancerId: true },
      })
      await Promise.all(
        pitched.map((p) =>
          notify({
            userId: p.freelancerId,
            tab: TABS.applications,
            type: 'posting_withdrawn',
            body: `"${opportunity.title}" was withdrawn by the client.`,
            href: '/dashboard/applications',
            agreementId: id,
          }),
        ),
      )

      return NextResponse.json({ ...cancelled, refund, declinedProposals: declined })
    }

    if (opportunity.status !== 'draft') {
      return NextResponse.json(
        { error: 'Only a draft can be edited — the budget is already committed' },
        { status: 400 },
      )
    }

    const deliverables = body.deliverables ? sanitizeDeliverables(body.deliverables) : undefined
    const attachments = body.attachments ? sanitizeAttachments(body.attachments) : undefined
    const budgetNIM = body.budgetNIM !== undefined ? Number(body.budgetNIM) : undefined
    const timelineDays = body.timelineDays !== undefined ? Number(body.timelineDays) : undefined

    const updated = await prisma.agreement.update({
      where: { id },
      data: {
        ...(body.title && { title: String(body.title).trim().slice(0, 140) }),
        ...(body.description && { description: String(body.description).trim().slice(0, 8000) }),
        ...(isValidCategory(body.category) && { category: body.category }),
        ...(body.serviceType && { serviceType: String(body.serviceType).trim().slice(0, 80) }),
        ...(budgetNIM && budgetNIM > 0 && { budgetNIM, amountNIM: budgetNIM }),
        ...(timelineDays &&
          timelineDays > 0 && {
            timelineDays,
            deadline: new Date(Date.now() + timelineDays * 86400000),
          }),
        ...(deliverables?.length && { deliverables: JSON.stringify(deliverables) }),
        ...(attachments && { attachments: JSON.stringify(attachments) }),
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Update opportunity error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


// Sending a withdrawn posting's budget back to the client.
//
// Same shape as every other payout out of this wallet (claim/route.ts,
// settlement.ts): reserve the row before signing so the unique constraint on
// (agreementId, type) settles any race, respect the rolling ceiling, and never
// retry a payout that might already have been broadcast.
type WithdrawRefund =
  | { ok: true; txHash: string }
  | { ok: false; status: number; error: string; detail?: string }

async function refundWithdrawnBudget({
  agreementId,
  amountNIM,
  clientAddress,
}: {
  agreementId: string
  amountNIM: number
  clientAddress: string
}): Promise<WithdrawRefund> {
  const dailyLimitNIM = Number(process.env.ESCROW_DAILY_LIMIT_NIM ?? '0')
  if (dailyLimitNIM > 0) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const recent = await prisma.escrowTransaction.aggregate({
      where: {
        type: { in: ['claim', 'refund', 'excess_refund', 'withdraw_refund'] },
        status: { in: ['confirmed', 'pending'] },
        createdAt: { gte: since },
      },
      _sum: { amountNIM: true },
    })
    const paidToday = Number(recent._sum.amountNIM ?? 0)
    if (paidToday + amountNIM > dailyLimitNIM) {
      console.error(
        `[escrow] DAILY LIMIT REACHED — refusing withdrawal refund of ${amountNIM} NIM for deal ${agreementId}.`,
      )
      return {
        ok: false,
        status: 429,
        error:
          'Payouts are temporarily paused for review. Your posting is untouched and nothing was lost — try withdrawing again later.',
      }
    }
  }

  let reservation
  try {
    reservation = await prisma.escrowTransaction.create({
      data: { agreementId, type: 'withdraw_refund', status: 'pending', amountNIM },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return {
        ok: false,
        status: 409,
        error: 'A refund for this posting is already in progress.',
      }
    }
    throw err
  }

  try {
    const payout = await payFromEscrow({ recipientAddress: clientAddress, amountNIM })
    await prisma.escrowTransaction.update({
      where: { id: reservation.id },
      data: { status: 'confirmed', txHash: payout.txHash, confirmedAt: new Date() },
    })
    return { ok: true, txHash: payout.txHash }
  } catch (err) {
    // A configuration failure is raised before anything is signed, so the row
    // goes away and the client can try again once an operator fixes it. Any
    // other failure might have reached the network, so it stays for a human:
    // reopening a payout that may have gone out is how somebody gets paid twice.
    const isPreFlight = err instanceof EscrowConfigError
    if (isPreFlight) {
      await prisma.escrowTransaction.delete({ where: { id: reservation.id } })
    } else {
      await prisma.escrowTransaction.update({
        where: { id: reservation.id },
        data: { status: 'failed' },
      })
    }
    console.error(`[escrow] withdrawal refund failed for deal ${agreementId}:`, err)
    return {
      ok: false,
      status: 500,
      error: isPreFlight
        ? 'The escrow wallet is misconfigured, so the budget could not be returned. Your posting is untouched.'
        : 'The refund could not be completed, so the posting was left as it is. An operator has been alerted.',
      detail: err instanceof Error ? err.message : String(err),
    }
  }
}
