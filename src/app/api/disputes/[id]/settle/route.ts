import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { requireSession } from '@/lib/auth'
import prisma from '@/lib/db'
import { payFromEscrow, EscrowConfigError } from '@/lib/escrow-wallet'
import { recordCompletion } from '@/lib/reputation'

// @nimiq/core is WebAssembly and signs with a real key — Node runtime, not edge.
export const runtime = 'nodejs'
// Two signatures and two broadcasts on a split verdict.
export const maxDuration = 60

const DAILY_LIMIT_NIM = Number(process.env.ESCROW_DAILY_LIMIT_NIM ?? '0')

// A mediated settlement. The AI wrote a recommendation; this is where it
// becomes a payment, and only because both people said it should.
//
// The escrow is custodial, so nothing on-chain enforces the verdict — the
// enforcement is the rules in this file. They are deliberately narrow:
//
//   1. Only the two parties can accept, and only their own acceptance.
//   2. Money moves on the second acceptance, never the first, and never on the
//      model's say-so alone.
//   3. The split comes from the stored verdict, never from the request body.
//      Nothing a caller sends influences who is paid or how much.
//   4. Each leg reserves its EscrowTransaction row before signing, so the
//      unique constraint on (agreementId, type) makes a double payout
//      impossible even if both parties accept at the same instant.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const user = await requireSession(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const dispute = await prisma.dispute.findUnique({
      where: { id },
      include: {
        agreement: {
          include: {
            buyer: { select: { id: true, address: true } },
            seller: { select: { id: true, address: true } },
          },
        },
      },
    })

    if (!dispute) return NextResponse.json({ error: 'Dispute not found' }, { status: 404 })

    // Rule 1 — who may accept. A stranger is told it does not exist.
    const isOpener = dispute.openerId === user.userId
    const isRespondent = dispute.respondentId === user.userId
    if (!isOpener && !isRespondent) {
      return NextResponse.json({ error: 'Dispute not found' }, { status: 404 })
    }

    if (dispute.status === 'resolved') {
      return NextResponse.json({ error: 'This dispute is already settled.' }, { status: 409 })
    }
    if (dispute.status !== 'under_review' || dispute.recommendedOutcome === null) {
      return NextResponse.json(
        { error: 'There is no verdict to accept yet.' },
        { status: 400 },
      )
    }
    // `escalate` means the mediator declined to call it. There is nothing to
    // accept, and pretending otherwise would pay somebody on a non-verdict.
    if (dispute.recommendedOutcome === 'escalate') {
      return NextResponse.json(
        {
          error:
            'The mediator could not reach a verdict on this evidence. This case needs human review — it cannot be settled automatically.',
        },
        { status: 400 },
      )
    }

    const opportunity = dispute.agreement
    const clientAddress = opportunity.buyer?.address
    const freelancerAddress = opportunity.seller?.address
    if (!clientAddress || !freelancerAddress) {
      return NextResponse.json(
        { error: 'A wallet address is missing for one of the parties.' },
        { status: 400 },
      )
    }

    // Record this party's acceptance. Conditional on it still being false, so
    // two clicks from the same person cannot both count as "the second one".
    const field = isOpener ? 'openerAccepted' : 'respondentAccepted'
    if (!dispute[field]) {
      await prisma.dispute.updateMany({
        where: { id, [field]: false },
        data: { [field]: true },
      })
    }

    const after = await prisma.dispute.findUniqueOrThrow({ where: { id } })
    if (!after.openerAccepted || !after.respondentAccepted) {
      return NextResponse.json({
        message: 'Your acceptance is recorded. The verdict takes effect once the other party accepts too.',
        openerAccepted: after.openerAccepted,
        respondentAccepted: after.respondentAccepted,
        settled: false,
      })
    }

    // ---- Both sides have accepted. The verdict is now binding. ----

    // Rule 3 — the arithmetic, in integer luna so a split can neither invent
    // money nor strand a fraction of it. The two legs sum to the escrow
    // exactly, by construction: the client's share is the remainder.
    const percent = Math.max(0, Math.min(100, after.freelancerPercent ?? 0))
    const totalLuna = Math.round(Number(opportunity.amountNIM) * 1e5)
    const freelancerLuna = Math.floor((totalLuna * percent) / 100)
    const clientLuna = totalLuna - freelancerLuna

    const legs = [
      { type: 'claim', recipient: freelancerAddress, luna: freelancerLuna, who: 'freelancer' },
      { type: 'refund', recipient: clientAddress, luna: clientLuna, who: 'client' },
    ].filter((leg) => leg.luna > 0)

    // Rule 4's ceiling, checked across everything about to leave the wallet.
    if (DAILY_LIMIT_NIM > 0) {
      const outgoing = legs.reduce((sum, leg) => sum + leg.luna / 1e5, 0)
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
      const recent = await prisma.escrowTransaction.aggregate({
        where: {
          type: { in: ['claim', 'refund'] },
          status: { in: ['confirmed', 'pending'] },
          createdAt: { gte: since },
        },
        _sum: { amountNIM: true },
      })
      const paidToday = Number(recent._sum.amountNIM ?? 0)
      if (paidToday + outgoing > DAILY_LIMIT_NIM) {
        console.error(
          `[escrow] DAILY LIMIT REACHED — refusing settlement of ${outgoing} NIM for deal ${opportunity.id}. ${paidToday} NIM already paid in the last 24h against a ${DAILY_LIMIT_NIM} NIM ceiling.`,
        )
        return NextResponse.json(
          {
            error:
              'Payouts are temporarily paused for review. Both acceptances are recorded and nothing was lost — the settlement will complete once an operator lifts the pause.',
          },
          { status: 429 },
        )
      }
    }

    const paid: { who: string; amountNIM: number; txHash: string }[] = []

    for (const leg of legs) {
      const amountNIM = leg.luna / 1e5

      // Already sent on an earlier attempt? Report it, do not repeat it.
      const settled = await prisma.escrowTransaction.findFirst({
        where: { agreementId: opportunity.id, type: leg.type, status: 'confirmed' },
      })
      if (settled) {
        paid.push({ who: leg.who, amountNIM, txHash: settled.txHash ?? '' })
        continue
      }

      // Reserve before signing. If both parties' requests raced to here, one
      // loses this insert and never reaches the signer.
      let reservation
      try {
        reservation = await prisma.escrowTransaction.create({
          data: { agreementId: opportunity.id, type: leg.type, status: 'pending', amountNIM },
        })
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          return NextResponse.json(
            { error: 'This settlement is already being paid out.' },
            { status: 409 },
          )
        }
        throw err
      }

      try {
        const payout = await payFromEscrow({ recipientAddress: leg.recipient, amountNIM })
        await prisma.escrowTransaction.update({
          where: { id: reservation.id },
          data: { status: 'confirmed', txHash: payout.txHash, confirmedAt: new Date() },
        })
        paid.push({ who: leg.who, amountNIM, txHash: payout.txHash })
      } catch (err) {
        // Same reasoning as the claim route: a configuration error is raised
        // before anything is signed, so the reservation is released and the
        // settlement can be retried once an operator fixes it. Any other
        // failure might have reached the network, so the row stays `failed`
        // and a human decides — reopening a payout that may have gone out is
        // how somebody gets paid twice.
        const isPreFlight = err instanceof EscrowConfigError
        if (isPreFlight) {
          await prisma.escrowTransaction.delete({ where: { id: reservation.id } })
        } else {
          await prisma.escrowTransaction.update({
            where: { id: reservation.id },
            data: { status: 'failed' },
          })
        }

        console.error(`[escrow] settlement leg (${leg.who}) failed for deal ${opportunity.id}:`, err)

        return NextResponse.json(
          {
            error: isPreFlight
              ? 'The escrow wallet is misconfigured — the settlement is agreed but cannot pay out until an operator fixes it.'
              : `The ${leg.who}'s share could not be paid. Both acceptances stand and an operator has been alerted.`,
            detail: err instanceof Error ? err.message : String(err),
            partiallyPaid: paid,
          },
          { status: 500 },
        )
      }
    }

    // Both legs are on-chain. Close the dispute and put the deal in the
    // terminal state that describes what actually happened to the money.
    const finalStatus = percent === 100 ? 'completed' : percent === 0 ? 'refunded' : 'settled'

    await prisma.$transaction([
      prisma.dispute.update({
        where: { id },
        data: { status: 'resolved', resolvedAt: new Date() },
      }),
      prisma.agreement.update({
        where: { id: opportunity.id },
        data: {
          status: finalStatus,
          ...(percent === 100 ? { completedAt: new Date() } : {}),
        },
      }),
      prisma.message.create({
        data: {
          agreementId: opportunity.id,
          senderId: user.userId,
          type: 'system',
          content:
            `Both parties accepted the mediator's verdict. Escrow settled on-chain: ` +
            paid.map((p) => `${p.amountNIM.toFixed(2)} NIM to the ${p.who}`).join(', ') +
            '.',
        },
      }),
    ])

    // A verdict that pays the freelancer in full is a delivered job, and their
    // completion record should say so. A split or a refund is not a completion
    // for either side — the dispute is already on both records from when it
    // was opened.
    if (percent === 100) {
      await recordCompletion([opportunity.buyerId, opportunity.sellerId])
    }

    return NextResponse.json({
      message: 'The verdict is settled and the escrow has been paid out on-chain.',
      settled: true,
      freelancerPercent: percent,
      payouts: paid,
    })
  } catch (error) {
    console.error('Settle dispute error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
