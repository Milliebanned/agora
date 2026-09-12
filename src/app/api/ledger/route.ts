import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { ledgerFor } from '@/lib/escrow-ledger'

// Where this person's money actually is. Both sides are returned because one
// wallet can be on both — the side switch in the profile changes what the
// dashboard leads with, not what has already happened.
export async function GET(request: NextRequest) {
  try {
    const user = await requireSession(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json(await ledgerFor(user.userId))
  } catch (error) {
    console.error('Ledger error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
