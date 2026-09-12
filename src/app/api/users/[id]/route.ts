import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
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
    const session = await requireSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    // A cookie proved somebody is signed in; it did not prove they are this
    // person. Without this check any signed-in wallet could rewrite anyone
    // else's name and bio by passing their id.
    if (session.userId !== id) {
      return NextResponse.json({ error: 'You can only edit your own profile' }, { status: 403 })
    }

    const body = await request.json()
    const displayName =
      typeof body.displayName === 'string' ? body.displayName.trim().slice(0, 60) : undefined
    const bio = typeof body.bio === 'string' ? body.bio.trim().slice(0, 600) : undefined

    const user = await prisma.user.update({
      where: { id },
      data: {
        // Empty is a real choice: it clears a name rather than being ignored.
        ...(displayName !== undefined && { displayName: displayName || null }),
        ...(bio !== undefined && { bio: bio || null }),
      },
    })

    return NextResponse.json(user)
  } catch (error) {
    console.error('Update user error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
