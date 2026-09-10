import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import prisma from '@/lib/db'
import { settleEscrow } from '@/lib/settlement'
import { recordCompletion } from '@/lib/reputation'

// @nimiq/core is WebAssembly and signs with a real key — Node runtime, not edge.
export const runtime = 'nodejs'
// Two signatures and two broadcasts on a split verdict.
export const maxDuration = 60

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

    const body = await request.json().catch(() => ({}) as { decision?: string })
    const decision = (body as { decision?: string }).decision === 'reject' ? 'rejected' : 'accepted'

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

    // Record this party's answer. Conditional on it still being unset, so two
    // clicks from the same person cannot both count as "the second one".
    const field = isOpener ? 'openerDecision' : 'respondentDecision'
    if (!dispute[field]) {
      await prisma.dispute.updateMany({
        where: { id, [field]: null },
        data: { [field]: decision },
      })
    }

    const after = await prisma.dispute.findUniqueOrThrow({ where: { id } })

    // A rejection ends this verdict. It does not end the dispute, and it moves
    // no money: the escrow stays exactly where it is. What it ends is the
    // pretence that the model settled anything — the parties either produce
    // more evidence and ask for a fresh verdict, or resolve it between
    // themselves.
    if (after.openerDecision === 'rejected' || after.respondentDecision === 'rejected') {
      const rejecter = after.openerDecision === 'rejected' ? dispute.openerId : dispute.respondentId

      await prisma.$transaction([
        prisma.dispute.update({ where: { id }, data: { status: 'escalated' } }),
        prisma.message.create({
          data: {
            agreementId: opportunity.id,
            senderId: rejecter,
            type: 'system',
            content:
              'The mediator’s verdict was rejected, so it is not binding and no funds have moved. ' +
              'Add anything the mediator did not see to this chat and request a fresh verdict, or agree an outcome between yourselves.',
          },
        }),
      ])

      return NextResponse.json({
        message:
          'Your rejection is recorded. The verdict is not binding and the escrow has not moved. You can add evidence here and request a fresh verdict.',
        settled: false,
        rejected: true,
        openerDecision: after.openerDecision,
        respondentDecision: after.respondentDecision,
      })
    }

    if (after.openerDecision !== 'accepted' || after.respondentDecision !== 'accepted') {
      return NextResponse.json({
        message: 'Your acceptance is recorded. The verdict takes effect once the other party accepts too.',
        openerDecision: after.openerDecision,
        respondentDecision: after.respondentDecision,
        settled: false,
      })
    }

    // ---- Both sides have accepted. The verdict is now binding. ----
    //
    // The money moves through the same code a human mediator's ruling uses.
    // Who authorised a settlement differs; how the escrow is divided and paid
    // must not.
    const percent = Math.max(0, Math.min(100, after.freelancerPercent ?? 0))

    const result = await settleEscrow({
      agreementId: opportunity.id,
      percent,
      freelancerAddress,
      clientAddress,
      amountNIM: Number(opportunity.amountNIM),
    })

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, detail: result.detail, partiallyPaid: result.paid },
        {
          status:
            result.failure === 'daily_limit' ? 429 : result.failure === 'in_progress' ? 409 : 500,
        },
      )
    }

    const paid = result.paid

    await prisma.$transaction([
      prisma.dispute.update({
        where: { id },
        data: { status: 'resolved', resolvedAt: new Date() },
      }),
      prisma.agreement.update({
        where: { id: opportunity.id },
        data: {
          status: result.finalStatus,
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
