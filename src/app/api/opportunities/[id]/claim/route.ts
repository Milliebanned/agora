import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { requireSession } from '@/lib/auth'
import prisma from '@/lib/db'
import { payFromEscrow, EscrowConfigError } from '@/lib/escrow-wallet'
import { getTransactionsByAddress, sameAddress } from '@/lib/nimiq-rpc'

// @nimiq/core is WebAssembly and signs with a real key — it needs the Node
// runtime, not the edge.
export const runtime = 'nodejs'
// Signing plus a broadcast plus a chain lookup can outrun the 10s default.
export const maxDuration = 60

const DAILY_LIMIT_NIM = Number(process.env.ESCROW_DAILY_LIMIT_NIM ?? '0')

// The freelancer collects. This is the only route that moves money out of the
// escrow wallet, so every guard that matters lives here:
//
//   1. Only the assigned freelancer of an approved deal can call it.
//   2. The destination is the address they authenticated with, read from the
//      database. Nothing in the request body influences where money goes.
//   3. A unique constraint on (agreementId, type) means a concurrent second
//      call loses its insert and never reaches the signing step. The row is
//      written *before* signing, never after.
//   4. A rolling 24-hour outflow ceiling refuses and alerts rather than paying.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const user = await requireSession(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const opportunity = await prisma.agreement.findUnique({
      where: { id },
      include: { seller: { select: { id: true, address: true, displayName: true } } },
    })

    if (!opportunity) {
      return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 })
    }

    // Guard 1 — who is asking.
    if (opportunity.sellerId !== user.userId) {
      return NextResponse.json(
        { error: 'Only the freelancer on this deal can claim it' },
        { status: 403 },
      )
    }
    if (opportunity.status !== 'completed') {
      return NextResponse.json(
        { error: 'The client has not approved this work yet' },
        { status: 400 },
      )
    }

    // Guard 2 — where the money goes. From the database, never the request.
    const recipientAddress = opportunity.seller?.address
    if (!recipientAddress) {
      return NextResponse.json(
        { error: 'No wallet address on file for this freelancer' },
        { status: 400 },
      )
    }

    const amountNIM = Number(opportunity.amountNIM)

    // An already-settled claim is answered, not repeated.
    const settled = await prisma.escrowTransaction.findFirst({
      where: { agreementId: id, type: 'claim', status: 'confirmed' },
    })
    if (settled) {
      return NextResponse.json({
        message: 'This payout has already been made.',
        txHash: settled.txHash,
        alreadyPaid: true,
      })
    }

    // Guard 4 — the rolling ceiling, checked before anything is reserved.
    if (DAILY_LIMIT_NIM > 0) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
      const recent = await prisma.escrowTransaction.aggregate({
        where: {
          type: 'claim',
          status: { in: ['confirmed', 'pending'] },
          createdAt: { gte: since },
        },
        _sum: { amountNIM: true },
      })
      const paidToday = Number(recent._sum.amountNIM ?? 0)
      if (paidToday + amountNIM > DAILY_LIMIT_NIM) {
        // Loud on purpose: either the platform grew or something is draining it,
        // and both want a human looking within the hour.
        console.error(
          `[escrow] DAILY LIMIT REACHED — refusing payout of ${amountNIM} NIM for deal ${id}. ${paidToday} NIM already paid in the last 24h against a ${DAILY_LIMIT_NIM} NIM ceiling.`,
        )
        return NextResponse.json(
          {
            error: 'Payouts are temporarily paused for review. Your claim is safe and nothing was lost — try again later or contact support.',
          },
          { status: 429 },
        )
      }
    }

    // Guard 3 — reserve the right to pay before doing it. If two requests race,
    // exactly one survives this insert; the loser never reaches the signer.
    let reservation
    try {
      reservation = await prisma.escrowTransaction.create({
        data: { agreementId: id, type: 'claim', status: 'pending', amountNIM },
      })
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return NextResponse.json(
          { error: 'A payout for this deal is already in progress.' },
          { status: 409 },
        )
      }
      throw err
    }

    // A previous attempt may have broadcast successfully and failed to record
    // it. Ask the chain before signing a second transaction for the same deal.
    // The match has to be narrow: an unrelated payment of the same size from
    // somebody else must not be mistaken for this payout, or the freelancer
    // would be marked paid with nothing sent.
    try {
      const escrowAddress = process.env.NIMIQ_ESCROW_ADDRESS
      const history = escrowAddress ? await getTransactionsByAddress(recipientAddress, 50) : []
      const already = history.find(
        (tx) =>
          sameAddress(tx.from, escrowAddress) &&
          sameAddress(tx.to, recipientAddress) &&
          Math.abs(tx.value / 1e5 - amountNIM) < 0.00001 &&
          // Only a transfer made since this deal was approved can be its payout.
          (!tx.timestamp ||
            !opportunity.completedAt ||
            tx.timestamp * 1000 >= opportunity.completedAt.getTime() - 60_000),
      )
      if (already) {
        await prisma.escrowTransaction.update({
          where: { id: reservation.id },
          data: { status: 'confirmed', txHash: already.hash, confirmedAt: new Date() },
        })
        return NextResponse.json({
          message: 'This payout already reached your wallet.',
          txHash: already.hash,
          alreadyPaid: true,
        })
      }
    } catch (err) {
      // The chain lookup is a safety net, not a gate. If the node is
      // unreachable the unique constraint is still holding the line.
      console.warn('[escrow] pre-payout chain check failed:', err)
    }

    try {
      const payout = await payFromEscrow({ recipientAddress, amountNIM })

      await prisma.escrowTransaction.update({
        where: { id: reservation.id },
        data: { status: 'confirmed', txHash: payout.txHash, confirmedAt: new Date() },
      })

      await prisma.message.create({
        data: {
          agreementId: id,
          senderId: user.userId,
          type: 'system',
          content: `Escrow paid out: ${amountNIM.toFixed(2)} NIM sent to the freelancer on-chain.`,
        },
      })

      return NextResponse.json({
        message: `${amountNIM.toFixed(2)} NIM is on its way to your wallet.`,
        txHash: payout.txHash,
      })
    } catch (err) {
      // The reservation is released only when we are certain nothing was
      // broadcast. A configuration error is raised before anything is signed,
      // so the row is deleted outright and the freelancer can retry once an
      // operator fixes the config — leaving it in place would let the unique
      // constraint lock them out of a payout that never happened. Any other
      // failure might have reached the network, so the row stays and a human
      // has to look: reopening a payout that may have gone out is exactly how
      // somebody gets paid twice.
      const isPreFlight = err instanceof EscrowConfigError
      if (isPreFlight) {
        await prisma.escrowTransaction.delete({ where: { id: reservation.id } })
      } else {
        await prisma.escrowTransaction.update({
          where: { id: reservation.id },
          data: { status: 'failed' },
        })
      }

      console.error(`[escrow] payout failed for deal ${id}:`, err)

      return NextResponse.json(
        {
          error: isPreFlight
            ? 'The escrow wallet is misconfigured — payouts are unavailable until an operator fixes it.'
            : 'The payout could not be completed. Nothing was deducted twice; an operator has been alerted.',
          detail: err instanceof Error ? err.message : String(err),
        },
        { status: 500 },
      )
    }
  } catch (error) {
    console.error('Claim escrow error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
