import { NextRequest, NextResponse } from 'next/server'
import { generateAgreement } from '@/lib/claude'
import { verifySessionToken } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    // Check auth
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

    return NextResponse.json(agreement)
  } catch (error) {
    console.error('Agreement generation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
