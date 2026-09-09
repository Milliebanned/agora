import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const user = await prisma.user.findUnique({
      where: { id: id },
      include: {
        reputationScores: true,
        sentAgreements: { where: { status: 'completed' }, select: { id: true } },
        receivedAgreements: { where: { status: 'completed' }, select: { id: true } },
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const rep = user.reputationScores

    return NextResponse.json({
      id: user.id,
      address: user.address,
      displayName: user.displayName,
      bio: user.bio,
      role: user.role,
      createdAt: user.createdAt,
      reputation: {
        totalAgreements: rep?.totalAgreements ?? 0,
        completedAgreements: rep?.completedAgreements ?? 0,
        avgDeliveryDays: Number(rep?.avgDeliveryDays ?? 0),
        disputeRate: Number(rep?.disputeRate ?? 0),
        trustScore: rep?.trustScore ?? 50,
      },
      completedCount: (user.sentAgreements?.length || 0) + (user.receivedAgreements?.length || 0),
    })
  } catch (error) {
    console.error('Get user error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const session = request.cookies.get('session')?.value
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Would verify session here
    const { displayName, bio } = await request.json()

    const user = await prisma.user.update({
      where: { id: id },
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
