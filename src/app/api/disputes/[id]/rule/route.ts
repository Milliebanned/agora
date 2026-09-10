import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import prisma from '@/lib/db'
import { isPlatformAdmin } from '@/lib/admin'
import { settleEscrow } from '@/lib/settlement'
import { recordCompletion } from '@/lib/reputation'

export const runtime = 'nodejs'
export const maxDuration = 60

// A platform mediator rules, and the escrow moves.
//
// This is the only place in the app where one person decides where somebody
// else's money goes. It is binding — no acceptance step, because the whole
// point is to break a deadlock where acceptance was never coming. So the
// guards are about who may do it and what they must say:
//
//   1. The caller's wallet must be named in PLATFORM_ADMIN_ADDRESSES.
//   2. The mediator must not be a party. Nobody rules on their own dispute,
//      whatever their role on the platform.
//   3. Reasoning is required and is shown to both parties. A binding decision
//      that does not explain itself is indistinguishable from theft.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const user = await requireSession(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Guard 1 — the address on the session, not anything in the request.
    const me = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { id: true, address: true },
    })
    if (!me || !isPlatformAdmin(me.address)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const { percent, reasoning } = (await request.json().catch(() => ({}))) as {
      percent?: number
      reasoning?: string
    }

    // Guard 3 — say why.
    if (!reasoning || String(reasoning).trim().length < 20) {
      return NextResponse.json(
        {
          error: 'A ruling needs reasoning',
          detail:
            'Both parties will read this, and one of them is losing money because of it. Explain what decided it, in at least a sentence.',
        },
        { status: 400 },
      )
    }
    if (typeof percent !== 'number' || !Number.isFinite(percent) || percent < 0 || percent > 100) {
      return NextResponse.json(
        { error: 'percent must be a number between 0 and 100 — the freelancer’s share of the escrow.' },
        { status: 400 },
      )
    }

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

    // Guard 2 — not your own case.
    if (dispute.openerId === me.id || dispute.respondentId === me.id) {
      return NextResponse.json(
        {
          error: 'You are a party to this dispute and cannot rule on it',
          detail:
            'A platform mediator who is also the client or the freelancer has no business deciding it. Another mediator has to take this one.',
        },
        { status: 403 },
      )
    }

    if (dispute.status === 'resolved') {
      return NextResponse.json({ error: 'This dispute is already settled.' }, { status: 409 })
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

    const ruling = Math.round(percent)

    // Record the ruling before the money moves, so a payout that fails halfway
    // still leaves the decision and its author on the record.
    await prisma.dispute.update({
      where: { id },
      data: {
        mediatorId: me.id,
        humanRuling: String(reasoning).slice(0, 4000),
        humanRulingPercent: ruling,
        ruledAt: new Date(),
      },
    })

    const result = await settleEscrow({
      agreementId: opportunity.id,
      percent: ruling,
      freelancerAddress,
      clientAddress,
      amountNIM: Number(opportunity.amountNIM),
    })

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, detail: result.detail, partiallyPaid: result.paid, ruled: true },
        { status: result.failure === 'daily_limit' ? 429 : result.failure === 'in_progress' ? 409 : 500 },
      )
    }

    await prisma.$transaction([
      prisma.dispute.update({
        where: { id },
        data: { status: 'resolved', resolvedAt: new Date() },
      }),
      prisma.agreement.update({
        where: { id: opportunity.id },
        data: {
          status: result.finalStatus,
          ...(ruling === 100 ? { completedAt: new Date() } : {}),
        },
      }),
      prisma.message.create({
        data: {
          agreementId: opportunity.id,
          senderId: me.id,
          type: 'system',
          content:
            `Human mediator's ruling — ${ruling}% to the freelancer, ${100 - ruling}% to the client. ` +
            `${String(reasoning).trim()}\n\nThis decision is final. Escrow settled on-chain: ` +
            result.paid.map((p) => `${p.amountNIM.toFixed(2)} NIM to the ${p.who}`).join(', ') +
            '.',
        },
      }),
    ])

    if (ruling === 100) {
      await recordCompletion([opportunity.buyerId, opportunity.sellerId])
    }

    return NextResponse.json({
      message: 'Ruling recorded and the escrow has been settled on-chain.',
      settled: true,
      freelancerPercent: ruling,
      payouts: result.paid,
    })
  } catch (error) {
    console.error('Human ruling error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
