import { NextRequest, NextResponse } from 'next/server'
import { generateChallenge } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const { address } = await request.json()

    if (!address) {
      return NextResponse.json({ error: 'Missing address' }, { status: 400 })
    }

    const challenge = generateChallenge(address)

    return NextResponse.json({
      challenge,
      timestamp: Date.now(),
    })
  } catch (error) {
    console.error('Challenge generation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
