import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: params.id },
      include: {
        reputationScores: true,
        sentAgreements: { where: { status: 'completed' }, select: { id: true } },
        receivedAgreements: { where: { status: 'completed' }, select: { id: true } },
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const rep = user.reputationScores?.[0] || {
      totalAgreements: 0,
      completedAgreements: 0,
      avgDeliveryDays: 0,
      disputeRate: 0,
      trustScore: 50,
    }

    return NextResponse.json({
      id: user.id,
      address: user.address,
      displayName: user.displayName,
      bio: user.bio,
      createdAt: user.createdAt,
      reputation: rep,
      completedCount: (user.sentAgreements?.length || 0) + (user.receivedAgreements?.length || 0),
    })
  } catch (error) {
    console.error('Get user error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = request.cookies.get('session')?.value
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Would verify session here
    const { displayName, bio } = await request.json()

    const user = await prisma.user.update({
      where: { id: params.id },
      data: {
        ...(displayName && { displayName }),
        ...(bio && { bio }),
      },
    })

    return NextResponse.json(user)
  } catch (error) {
    console.error('Update user error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
