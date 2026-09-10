import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import prisma from '@/lib/db'
import { hasPlatformMediator } from '@/lib/admin'

// A party asks for a person to look at it.
//
// This is the exit from the loop the AI cannot always close: a verdict was
// rejected, or the mediator declined to call it, and the escrow is held with
// two people who do not agree. Either of them can ask, at any point after a
// dispute exists — needing the other side's permission to ask for help would
// defeat the purpose.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const user = await requireSession(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (!hasPlatformMediator()) {
      return NextResponse.json(
        {
          error: 'This platform has no human mediator configured',
          detail:
            'PLATFORM_ADMIN_ADDRESSES is not set, so there is nobody who could rule on this. The escrow stays held.',
        },
        { status: 503 },
      )
    }

    const dispute = await prisma.dispute.findUnique({ where: { id } })
    if (!dispute) return NextResponse.json({ error: 'Dispute not found' }, { status: 404 })

    if (dispute.openerId !== user.userId && dispute.respondentId !== user.userId) {
      return NextResponse.json({ error: 'Dispute not found' }, { status: 404 })
    }
    if (dispute.status === 'resolved') {
      return NextResponse.json({ error: 'This dispute is already settled.' }, { status: 409 })
    }
    if (dispute.humanRequestedAt) {
      return NextResponse.json({
        message: 'A human mediator has already been asked to review this. It is in their queue.',
        alreadyRequested: true,
      })
    }

    const [updated] = await prisma.$transaction([
      prisma.dispute.update({
        where: { id },
        data: {
          status: 'human_review',
          humanRequestedAt: new Date(),
          humanRequestedById: user.userId,
        },
      }),
      prisma.message.create({
        data: {
          agreementId: dispute.agreementId,
          senderId: user.userId,
          type: 'system',
          content:
            'A human mediator has been asked to review this dispute. Their ruling is binding and ' +
            'will release the escrow — anything either of you still wants considered should be said here first.',
        },
      }),
    ])

    return NextResponse.json({
      message:
        'A human mediator has been asked to review this. Their decision is binding, so add anything they should see to the deal chat now.',
      dispute: updated,
    })
  } catch (error) {
    console.error('Request human mediation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
