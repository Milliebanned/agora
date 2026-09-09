import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import prisma from '@/lib/db'
import { parseAttachments, sanitizeAttachments } from '@/lib/opportunities'

// Marks an attachment as part of the delivery rather than part of the brief.
const DELIVERED_PREFIX = 'Delivered: '

// The freelancer hands in the work. Nothing moves on-chain here — this is the
// record the client reviews, and the record the mediator reads back against the
// deliverables if the two of them cannot agree.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const user = await requireSession(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const opportunity = await prisma.agreement.findUnique({ where: { id } })
    if (!opportunity) {
      return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 })
    }
    if (opportunity.sellerId !== user.userId) {
      return NextResponse.json(
        { error: 'Only the accepted freelancer can submit work' },
        { status: 403 },
      )
    }
    if (opportunity.status !== 'locked' && opportunity.status !== 'submitted') {
      return NextResponse.json(
        { error: `Work cannot be submitted while this is ${opportunity.status}` },
        { status: 400 },
      )
    }

    const body = await request.json()
    const summary = String(body.summary ?? '').trim()
    if (summary.length < 20) {
      return NextResponse.json(
        { error: 'Describe what you delivered (20+ characters)' },
        { status: 400 },
      )
    }

    // Delivery links join the posting's own attachments so the detail page —
    // and the mediator — read one list of everything relevant to the job.
    // Resubmitting replaces the previous delivery rather than stacking a second
    // copy of every link on top of it.
    const delivered = sanitizeAttachments(body.attachments)
    const briefAttachments = parseAttachments(opportunity.attachments).filter(
      (a) => !a.label.startsWith(DELIVERED_PREFIX),
    )
    const merged = [
      ...briefAttachments,
      ...delivered.map((a) => ({ ...a, label: `${DELIVERED_PREFIX}${a.label}` })),
    ]

    const updated = await prisma.agreement.update({
      where: { id },
      data: {
        workSubmission: summary.slice(0, 8000),
        workSubmittedAt: new Date(),
        status: 'submitted',
        attachments: JSON.stringify(merged.slice(0, 12)),
      },
    })

    await prisma.message.create({
      data: {
        agreementId: id,
        senderId: user.userId,
        type: 'system',
        content: `Work submitted for review${delivered.length ? ` with ${delivered.length} link${delivered.length > 1 ? 's' : ''}` : ''}.`,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Submit work error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
