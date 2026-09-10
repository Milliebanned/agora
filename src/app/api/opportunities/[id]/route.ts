import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import prisma from '@/lib/db'
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

    const opportunity = await prisma.agreement.findUnique({ where: { id } })
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
      const cancelled = await prisma.agreement.update({
        where: { id },
        data: { status: 'cancelled' },
      })
      await prisma.proposal.updateMany({
        where: { agreementId: id, status: 'pending' },
        data: { status: 'rejected' },
      })
      return NextResponse.json(cancelled)
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
