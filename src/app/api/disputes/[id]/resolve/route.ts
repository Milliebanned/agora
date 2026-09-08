import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken } from '@/lib/auth'
import { generateMediatorVerdict } from '@/lib/claude'
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
          },
        },
      },
    })

    if (!dispute) {
      return NextResponse.json({ error: 'Dispute not found' }, { status: 404 })
    }

    // Format data for AI mediator
    const agreementDetails = `
Title: ${dispute.agreement.title}
Description: ${dispute.agreement.description}
Amount: ${dispute.agreement.amountNIM} NIM
Deadline: ${dispute.agreement.deadline}
Terms: ${dispute.agreement.completionTerms}
`

    const timeline = dispute.agreement.milestones
      .map((m) => `${m.title}: ${m.status} (${m.createdAt})`)
      .join('\n')

    const messages = dispute.agreement.messages
      .map((m) => `${m.type}: ${m.content}`)
      .join('\n')

    const submittedWork = dispute.agreement.milestones
      .filter((m) => m.status === 'submitted')
      .map((m) => m.deliverable)
      .join('\n')

    // Generate verdict using Claude Sonnet
    const verdict = await generateMediatorVerdict(
      agreementDetails,
      timeline,
      messages,
      submittedWork,
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
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Resolve dispute error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
