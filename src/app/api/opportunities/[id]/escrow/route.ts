import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import prisma from '@/lib/db'

// Report where the escrow payment for this opportunity is meant to go.
//
// The address lives in server config, never in the bundle, so the browser has
// to ask for it — and asking is gated on being the client of a draft that is
// about to be funded. Nothing here moves money; it only names the destination
// the wallet dialog will show.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const user = await requireSession(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const escrowAddress = process.env.NIMIQ_ESCROW_ADDRESS
    if (!escrowAddress) {
      return NextResponse.json(
        { error: 'NIMIQ_ESCROW_ADDRESS is not configured on the server.' },
        { status: 500 },
      )
    }

    const opportunity = await prisma.agreement.findUnique({
      where: { id },
      select: { buyerId: true, amountNIM: true, status: true },
    })

    if (!opportunity) {
      return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 })
    }
    if (opportunity.buyerId !== user.userId) {
      return NextResponse.json({ error: 'Only the client funds this escrow' }, { status: 403 })
    }

    return NextResponse.json({
      escrowAddress,
      amountNIM: Number(opportunity.amountNIM),
      // Luna is Nimiq's smallest unit; the wallet takes the value in luna.
      amountLuna: Math.round(Number(opportunity.amountNIM) * 1e5),
      network: process.env.NEXT_PUBLIC_NIMIQ_NETWORK ?? 'testnet',
    })
  } catch (error) {
    console.error('Escrow destination error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
