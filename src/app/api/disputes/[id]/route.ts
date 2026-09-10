import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import prisma from '@/lib/db'

// The dispute a party is looking at. Only the two people in it can read it:
// a dispute contains the reason one side gave for distrusting the other, and
// that is nobody else's business.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const user = await requireSession(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const dispute = await prisma.dispute.findUnique({
      where: { id },
      include: {
        opener: { select: { id: true, displayName: true, address: true } },
        respondent: { select: { id: true, displayName: true, address: true } },
        agreement: {
          select: {
            id: true,
            title: true,
            description: true,
            status: true,
            amountNIM: true,
            buyerId: true,
            sellerId: true,
          },
        },
      },
    })

    if (!dispute) {
      return NextResponse.json({ error: 'Dispute not found' }, { status: 404 })
    }

    if (dispute.openerId !== user.userId && dispute.respondentId !== user.userId) {
      // Not 403: confirming that a dispute exists at this id is itself a leak.
      return NextResponse.json({ error: 'Dispute not found' }, { status: 404 })
    }

    return NextResponse.json({
      ...dispute,
      amountNIM: Number(dispute.agreement.amountNIM),
      // The page needs to know which side of the deal the reader is on to say
      // what a verdict would mean for them, and the roles are on the agreement
      // rather than the dispute.
      viewerRole: dispute.agreement.buyerId === user.userId ? 'client' : 'freelancer',
    })
  } catch (error) {
    console.error('Get dispute error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
