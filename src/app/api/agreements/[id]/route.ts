import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken } from '@/lib/auth'
import prisma from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = request.cookies.get('session')?.value
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await verifySessionToken(session)
    if (!user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    const agreement = await prisma.agreement.findUnique({
      where: { id: params.id },
      include: {
        buyer: { select: { id: true, address: true, displayName: true } },
        seller: { select: { id: true, address: true, displayName: true } },
        milestones: true,
        messages: { orderBy: { createdAt: 'desc' }, take: 50 },
        escrowTransactions: { orderBy: { createdAt: 'desc' } },
      },
    })

    if (!agreement) {
      return NextResponse.json({ error: 'Agreement not found' }, { status: 404 })
    }

    // Check if user is party to agreement
    if (agreement.buyerId !== user.userId && agreement.sellerId !== user.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    return NextResponse.json(agreement)
  } catch (error) {
    console.error('Get agreement error:', error)
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

    const user = await verifySessionToken(session)
    if (!user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    const agreement = await prisma.agreement.findUnique({
      where: { id: params.id },
    })

    if (!agreement) {
      return NextResponse.json({ error: 'Agreement not found' }, { status: 404 })
    }

    // Only buyer can update (for now)
    if (agreement.buyerId !== user.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { title, description, amountNIM, deadline, deliverables, completionTerms, refundTerms, status, sellerId } = await request.json()

    const updated = await prisma.agreement.update({
      where: { id: params.id },
      data: {
        ...(title && { title }),
        ...(description && { description }),
        ...(amountNIM && { amountNIM: parseFloat(amountNIM) }),
        ...(deadline && { deadline: new Date(deadline) }),
        ...(deliverables && { deliverables: JSON.stringify(deliverables) }),
        ...(completionTerms && { completionTerms }),
        ...(refundTerms && { refundTerms }),
        ...(status && { status }),
        ...(sellerId && { sellerId }),
      },
      include: {
        buyer: { select: { id: true, address: true, displayName: true } },
        seller: { select: { id: true, address: true, displayName: true } },
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Update agreement error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
