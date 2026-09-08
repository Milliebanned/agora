import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken } from '@/lib/auth'
import prisma from '@/lib/db'

export async function POST(
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

    const { title, description } = await request.json()
    if (!title) {
      return NextResponse.json({ error: 'Missing title' }, { status: 400 })
    }

    const agreement = await prisma.agreement.findUnique({
      where: { id: params.id },
    })

    if (!agreement) {
      return NextResponse.json({ error: 'Agreement not found' }, { status: 404 })
    }

    // Only buyer can create milestones
    if (agreement.buyerId !== user.userId) {
      return NextResponse.json({ error: 'Only buyer can create milestones' }, { status: 403 })
    }

    const milestone = await prisma.milestone.create({
      data: {
        agreementId: params.id,
        title,
        description: description || '',
        status: 'pending',
      },
    })

    // Add system message
    await prisma.message.create({
      data: {
        agreementId: params.id,
        senderId: user.userId,
        type: 'system',
        content: `Milestone created: ${title}`,
      },
    })

    return NextResponse.json(milestone, { status: 201 })
  } catch (error) {
    console.error('Create milestone error:', error)
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

    const { milestoneId, status, deliverable } = await request.json()
    if (!milestoneId) {
      return NextResponse.json({ error: 'Missing milestoneId' }, { status: 400 })
    }

    const agreement = await prisma.agreement.findUnique({
      where: { id: params.id },
    })

    if (!agreement) {
      return NextResponse.json({ error: 'Agreement not found' }, { status: 404 })
    }

    const milestone = await prisma.milestone.findUnique({
      where: { id: milestoneId },
    })

    if (!milestone || milestone.agreementId !== params.id) {
      return NextResponse.json({ error: 'Milestone not found' }, { status: 404 })
    }

    // Seller can submit, buyer can approve
    let newStatus = milestone.status
    if (status === 'submitted' && agreement.sellerId === user.userId) {
      newStatus = 'submitted'
    } else if (status === 'approved' && agreement.buyerId === user.userId) {
      newStatus = 'approved'
    } else {
      return NextResponse.json({ error: 'Unauthorized action' }, { status: 403 })
    }

    const updated = await prisma.milestone.update({
      where: { id: milestoneId },
      data: {
        status: newStatus,
        ...(deliverable && { deliverable }),
        ...(newStatus === 'submitted' && { submittedAt: new Date() }),
        ...(newStatus === 'approved' && { approvedAt: new Date() }),
      },
    })

    // Add system message
    await prisma.message.create({
      data: {
        agreementId: params.id,
        senderId: user.userId,
        type: 'system',
        content: `Milestone ${newStatus}: ${milestone.title}`,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Update milestone error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
