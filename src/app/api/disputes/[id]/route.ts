import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import prisma from '@/lib/db'
import { disputeForViewer } from '@/lib/disputes'

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

    const result = await disputeForViewer(id, user.userId)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json(result.dispute)
  } catch (error) {
    console.error('Get dispute error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
