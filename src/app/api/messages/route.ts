import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken } from '@/lib/auth'
import prisma from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const session = request.cookies.get('session')?.value
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await verifySessionToken(session)
    if (!user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
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

    return NextResponse.json(message, { status: 201 })
  } catch (error) {
    console.error('Create message error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = request.cookies.get('session')?.value
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await verifySessionToken(session)
    if (!user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
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
      return NextResponse.json({ error: 'Not a party to this agreement' }, { status: 403 })
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
