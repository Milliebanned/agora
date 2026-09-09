import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import prisma from '@/lib/db'
import { recordCompletion } from '@/lib/reputation'

// Approval is release. The client's approval reveals the pre-image, and the
// pre-image is the only thing that can spend the HTLC — so the money moves
// because the contract says so, not because the app decided to pay out.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const user = await requireSession(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const opportunity = await prisma.agreement.findUnique({
      where: { id },
      include: { seller: { select: { id: true, address: true, displayName: true } } },
    })

    if (!opportunity) {
      return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 })
    }
    if (opportunity.buyerId !== user.userId) {
      return NextResponse.json({ error: 'Only the client can approve the work' }, { status: 403 })
    }
    if (opportunity.status !== 'submitted') {
      return NextResponse.json(
        { error: 'There is no submitted work to approve yet' },
        { status: 400 },
      )
    }
    if (!opportunity.htlcPreImage) {
      return NextResponse.json({ error: 'This escrow was never committed' }, { status: 400 })
    }

    const [completed] = await prisma.$transaction([
      prisma.agreement.update({
        where: { id },
        data: { status: 'completed', completedAt: new Date() },
        include: {
          buyer: { select: { id: true, address: true, displayName: true } },
          seller: { select: { id: true, address: true, displayName: true } },
        },
      }),
      prisma.message.create({
        data: {
          agreementId: id,
          senderId: user.userId,
          type: 'system',
          content: `Work approved. ${Number(opportunity.amountNIM).toFixed(2)} NIM is now claimable by the freelancer.`,
        },
      }),
    ])

    await recordCompletion([opportunity.buyerId, opportunity.sellerId])

    return NextResponse.json({
      opportunity: completed,
      message: `Approved. ${Number(opportunity.amountNIM).toFixed(2)} NIM is now claimable by ${opportunity.seller?.displayName ?? 'the freelancer'}.`,
    })
  } catch (error) {
    console.error('Approve work error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
