import { NextRequest, NextResponse } from 'next/server'
import { issueChallenge } from '@/lib/action-signing'

export const runtime = 'nodejs'

// The text a wallet signs to sign in.
//
// Recorded now, where it used to be a timestamp the server forgot the moment
// it sent it. A challenge nobody wrote down cannot be checked off later, so
// the same signature worked forever and for anyone who saw it.
export async function POST(request: NextRequest) {
  try {
    const { address } = await request.json()
    if (!address || typeof address !== 'string') {
      return NextResponse.json({ error: 'Missing address' }, { status: 400 })
    }

    // No session required: this is what you do before you have one. The nonce
    // is bound to the address asking, and proves nothing until it comes back
    // signed by the key that address belongs to.
    const challenge = await issueChallenge({ address, action: 'login' })

    return NextResponse.json({ challenge: challenge.message, nonce: challenge.nonce })
  } catch (error) {
    console.error('Challenge generation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
