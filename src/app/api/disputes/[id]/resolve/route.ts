import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken } from '@/lib/auth'
import { generateMediatorVerdict } from '@/lib/claude'
import { formatDate, parseJsonArray } from '@/lib/utils'
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

    const dispute = await prisma.dispute.findUnique({
      where: { id: params.id },
      include: {
        agreement: {
          include: {
            messages: true,
            milestones: true,
            buyer: { select: { displayName: true } },
            seller: { select: { displayName: true } },
          },
        },
        opener: { select: { displayName: true } },
        respondent: { select: { displayName: true } },
      },
    })

    if (!dispute) {
      return NextResponse.json({ error: 'Dispute not found' }, { status: 404 })
    }

    // Format comprehensive context for AI mediator
    const agreementDetails = `
Agreement: ${dispute.agreement.title}
Amount: ${dispute.agreement.amountNIM} NIM
Buyer: ${dispute.agreement.buyer.displayName}
Seller: ${dispute.agreement.seller?.displayName || 'Unassigned'}
Created: ${formatDate(dispute.agreement.createdAt)}
Deadline: ${formatDate(dispute.agreement.deadline)}
Status: ${dispute.agreement.status}

Description:
${dispute.agreement.description}

Terms:
${dispute.agreement.completionTerms}
`

    const timeline = [
      `Agreement created: ${formatDate(dispute.agreement.createdAt)}`,
      ...dispute.agreement.milestones.map(
        (m) => `Milestone "${m.title}" - ${m.status} at ${formatDate(m.createdAt)}`,
      ),
      `Dispute opened by ${dispute.opener.displayName}: ${formatDate(dispute.createdAt)}`,
    ].join('\n')

    const messages = dispute.agreement.messages
      .slice(0, 20) // Last 20 messages
      .map((m) => `[${formatDate(m.createdAt)}] ${m.type === 'system' ? '🔔 SYSTEM' : m.type}: ${m.content}`)
      .join('\n')

    const submittedWork = dispute.agreement.milestones
      .filter((m) => m.deliverable)
      .map((m) => `${m.title}: ${m.deliverable}`)
      .join('\n\n')

    const disputeContext = `
Dispute Reason: ${dispute.reason}
Opened By: ${dispute.opener.displayName}
Against: ${dispute.respondent.displayName}
`

    // Generate verdict using Claude Sonnet
    const verdict = await generateMediatorVerdict(
      agreementDetails + disputeContext,
      timeline,
      messages,
      submittedWork || 'No work submitted',
    )

    if (!verdict) {
      return NextResponse.json({ error: 'Failed to generate verdict' }, { status: 500 })
    }

    // Update dispute with verdict
    const updated = await prisma.dispute.update({
      where: { id: params.id },
      data: {
        status: 'under_review',
        caseSummary: verdict.case_summary,
        findings: verdict.findings,
        recommendedOutcome: verdict.recommended_outcome,
      },
      include: {
        opener: { select: { displayName: true, id: true } },
        respondent: { select: { displayName: true, id: true } },
      },
    })

    // Add system message about verdict
    await prisma.message.create({
      data: {
        agreementId: dispute.agreementId,
        senderId: user.userId,
        type: 'system',
        content: `AI Mediator Verdict: ${verdict.recommended_outcome.toUpperCase()}. ${verdict.case_summary}`,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Resolve dispute error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
