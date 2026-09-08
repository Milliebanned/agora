import { NextRequest, NextResponse } from 'next/server'
import { generateAgreement, checkRiskFlags } from '@/lib/claude'
import { verifySessionToken } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const session = request.cookies.get('session')?.value
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await verifySessionToken(session)
    if (!user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    const { userRequest } = await request.json()
    if (!userRequest) {
      return NextResponse.json({ error: 'Missing userRequest' }, { status: 400 })
    }

    // Generate agreement using Claude Sonnet
    const agreement = await generateAgreement(userRequest)
    if (!agreement) {
      return NextResponse.json({ error: 'Failed to generate agreement' }, { status: 500 })
    }

    // Quick risk check
    const allDetails = `
Title: ${agreement.title}
Scope: ${agreement.scope}
Deliverables: ${agreement.deliverables.join(', ')}
Timeline: ${agreement.timeline_days} days
Amount: ${agreement.amount_nim} NIM
Completion: ${agreement.completion_conditions}
Refund: ${agreement.refund_conditions}
`

    const additionalRiskFlags = await checkRiskFlags(allDetails)
    const allRiskFlags = [...(agreement.risk_flags || []), ...additionalRiskFlags]

    return NextResponse.json({
      ...agreement,
      risk_flags: allRiskFlags,
    })
  } catch (error) {
    console.error('Agreement generation error:', error)
    const detail = error instanceof Error ? error.message : String(error)
    const missingKey = !process.env.ANTHROPIC_API_KEY
    return NextResponse.json(
      {
        error: missingKey ? 'ANTHROPIC_API_KEY is not set' : 'Agreement generation failed',
        detail,
      },
      { status: 500 },
    )
  }
}
