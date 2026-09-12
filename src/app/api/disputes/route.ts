import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import prisma from '@/lib/db'
import { notify, TABS } from '@/lib/notifications'
import { recordDispute } from '@/lib/reputation'
import { isPlatformAdmin } from '@/lib/admin'

export async function GET(request: NextRequest) {
  try {
    const user = await requireSession(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // A platform mediator additionally sees every case waiting on a human —
    // otherwise there is no way to find the queue they are meant to work.
    // They do not see other people's disputes that nobody asked them to judge.
    const me = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { address: true },
    })
    const mediatorClause = isPlatformAdmin(me?.address)
      ? [{ status: 'human_review' as const }]
      : []

    const disputes = await prisma.dispute.findMany({
      where: {
        OR: [
          { openerId: user.userId },
          { respondentId: user.userId },
          ...mediatorClause,
        ],
      },
      include: {
        opener: true,
        respondent: true,
        agreement: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(disputes)
  } catch (error) {
    console.error('Get disputes error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireSession(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { agreementId, reason } = await request.json()

    if (!agreementId || !reason) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    // Verify user is party to the agreement
    const agreement = await prisma.agreement.findUnique({
      where: { id: agreementId },
    })

    if (!agreement) {
      return NextResponse.json({ error: 'Agreement not found' }, { status: 404 })
    }

    const isParty =
      agreement.buyerId === user.userId || agreement.sellerId === user.userId
    if (!isParty) {
      return NextResponse.json(
        { error: 'You are not a party to this agreement' },
        { status: 403 },
      )
    }

    // There is nothing to dispute until an engagement exists: an open posting
    // has no counterparty and no locked funds.
    if (agreement.status !== 'locked' && agreement.status !== 'submitted') {
      return NextResponse.json(
        { error: `A ${agreement.status} opportunity cannot be disputed` },
        { status: 400 },
      )
    }

    const respondentId =
      agreement.buyerId === user.userId ? agreement.sellerId : agreement.buyerId

    if (!respondentId) {
      return NextResponse.json({ error: 'Cannot open dispute without respondent' }, { status: 400 })
    }

    // The opportunity itself moves to disputed, so the board, the deals list
    // and the escrow panel all stop offering actions that are now off the table.
    const [dispute] = await prisma.$transaction([
      prisma.dispute.create({
        data: {
          agreementId,
          openerId: user.userId,
          respondentId,
          reason: String(reason).slice(0, 4000),
          status: 'open',
        },
        include: { opener: true, respondent: true },
      }),
      prisma.agreement.update({ where: { id: agreementId }, data: { status: 'disputed' } }),
      prisma.message.create({
        data: {
          agreementId,
          senderId: user.userId,
          type: 'system',
          content: `Dispute opened. The AI mediator reviews this deal against its original requirements, the timeline, and this chat.`,
        },
      }),
    ])

    await recordDispute([agreement.buyerId, agreement.sellerId])

    await notify({
      userId: respondentId,
      tab: TABS.disputes,
      type: 'dispute_opened',
      body: `A dispute was opened on "${agreement.title}". Your response is part of what the mediator reads.`,
      href: `/dashboard/disputes/${dispute.id}`,
      agreementId,
    })

    return NextResponse.json(dispute, { status: 201 })
  } catch (error) {
    console.error('Create dispute error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
