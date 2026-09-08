import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken } from '@/lib/auth'
import prisma from '@/lib/db'

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

    const disputes = await prisma.dispute.findMany({
      where: {
        OR: [{ openerId: user.userId }, { respondentId: user.userId }],
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
    const session = request.cookies.get('session')?.value
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await verifySessionToken(session)
    if (!user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
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

    // Create dispute
    const disputeOpener = agreement.buyerId === user.userId ? 'buyer' : 'seller'
    const respondentId =
      agreement.buyerId === user.userId ? agreement.sellerId : agreement.buyerId

    if (!respondentId) {
      return NextResponse.json({ error: 'Cannot open dispute without respondent' }, { status: 400 })
    }

    const dispute = await prisma.dispute.create({
      data: {
        agreementId,
        openerId: user.userId,
        respondentId,
        reason,
        status: 'open',
      },
      include: {
        opener: true,
        respondent: true,
      },
    })

    return NextResponse.json(dispute, { status: 201 })
  } catch (error) {
    console.error('Create dispute error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
