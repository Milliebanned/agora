import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import prisma from '@/lib/db'
import { notify, TABS } from '@/lib/notifications'
import { isPlatformAdmin } from '@/lib/admin'

// Chat is private and it opens late: only the client and the freelancer they
// accepted can post, and only once that acceptance has happened. Before then
// the proposal is the whole conversation. Every message is kept — the mediator
// reads this thread as evidence.

export async function POST(request: NextRequest) {
  try {
    const user = await requireSession(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { agreementId, content } = await request.json()

    if (!agreementId || !content) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    // Verify user is party to agreement
    const agreement = await prisma.agreement.findUnique({
      where: { id: agreementId },
    })

    if (!agreement) {
      return NextResponse.json({ error: 'Agreement not found' }, { status: 404 })
    }

    if (agreement.buyerId !== user.userId && agreement.sellerId !== user.userId) {
      return NextResponse.json({ error: 'Not a party to this agreement' }, { status: 403 })
    }

    if (!agreement.sellerId) {
      return NextResponse.json(
        { error: 'The chat opens once a freelancer is accepted' },
        { status: 400 },
      )
    }

    const message = await prisma.message.create({
      data: {
        agreementId,
        senderId: user.userId,
        type: 'text',
        content: content.trim().substring(0, 1000), // Max 1000 chars
      },
      include: {
        sender: { select: { displayName: true } },
      },
    })

    const recipientId =
      agreement.buyerId === user.userId ? agreement.sellerId : agreement.buyerId
    await notify({
      userId: recipientId,
      tab: TABS.deals,
      type: 'message',
      body: `${message.sender.displayName ?? 'The other party'} sent a message on "${agreement.title}".`,
      href: `/dashboard/opportunities/${agreementId}`,
      agreementId,
    })

    return NextResponse.json(message, { status: 201 })
  } catch (error) {
    console.error('Create message error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireSession(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const agreementId = request.nextUrl.searchParams.get('agreementId')
    if (!agreementId) {
      return NextResponse.json({ error: 'Missing agreementId' }, { status: 400 })
    }

    const agreement = await prisma.agreement.findUnique({
      where: { id: agreementId },
    })

    if (!agreement) {
      return NextResponse.json({ error: 'Agreement not found' }, { status: 404 })
    }

    if (agreement.buyerId !== user.userId && agreement.sellerId !== user.userId) {
      // A platform mediator reads the chat of a case referred to them, because
      // it is the evidence they are ruling on. Reading only — posting stays
      // with the two parties, so a mediator cannot become a participant in the
      // conversation they are judging. Their reasoning reaches the parties as
      // a system message when they rule.
      const me = await prisma.user.findUnique({
        where: { id: user.userId },
        select: { address: true },
      })
      const referred = await prisma.dispute.count({
        where: {
          agreementId,
          humanRequestedAt: { not: null },
          status: { not: 'resolved' },
        },
      })
      if (!isPlatformAdmin(me?.address) || referred === 0) {
        return NextResponse.json({ error: 'Not a party to this agreement' }, { status: 403 })
      }
    }

    const messages = await prisma.message.findMany({
      where: { agreementId },
      include: {
        sender: { select: { displayName: true, id: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    return NextResponse.json(messages.reverse())
  } catch (error) {
    console.error('Get messages error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
