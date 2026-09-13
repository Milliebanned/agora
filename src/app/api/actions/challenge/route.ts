import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import prisma from '@/lib/db'
import { issueChallenge, SIGNED_ACTIONS, type SignedAction } from '@/lib/action-signing'

export const runtime = 'nodejs'

// Ask for something to sign.
//
// The server decides what the text says, which is the whole point: the client
// asks "I want to claim this deal" and gets back a sentence naming that deal
// and its amount. It cannot ask for a sentence of its own choosing, so what
// the wallet displays is always what the server will act on.
export async function POST(request: NextRequest) {
  try {
    const session = await requireSession(request)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const action = String(body.action ?? '') as SignedAction
    if (!(action in SIGNED_ACTIONS)) {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
    const subjectId = typeof body.subjectId === 'string' ? body.subjectId : null

    // The name and the amount are looked up here rather than taken from the
    // request, so the wallet cannot be shown "2 NIM" for a deal worth 2000.
    let subject: string | null = null
    let amountNIM: number | null = null
    if (subjectId) {
      const agreement = await prisma.agreement.findUnique({
        where: { id: subjectId },
        select: { title: true, amountNIM: true },
      })
      if (agreement) {
        subject = agreement.title
        amountNIM = Number(agreement.amountNIM)
      } else {
        const listing = await prisma.serviceListing.findUnique({
          where: { id: subjectId },
          select: { title: true, priceNIM: true },
        })
        if (listing) {
          subject = listing.title
          amountNIM = Number(listing.priceNIM)
        }
      }
    }

    const challenge = await issueChallenge({
      address: session.address,
      action,
      subjectId,
      subject,
      // Only where money actually moves. A proposal's own bid is not the
      // escrow, and showing an amount on an action that moves none would be
      // teaching people to ignore the number.
      amountNIM: ['claim_escrow', 'approve_work', 'accept_proposal', 'withdraw_posting'].includes(
        action,
      )
        ? amountNIM
        : null,
    })

    return NextResponse.json(challenge)
  } catch (error) {
    console.error('Issue challenge error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
