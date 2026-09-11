import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import prisma from '@/lib/db'
import { recordEngagement } from '@/lib/reputation'
import { payFromEscrow, EscrowConfigError } from '@/lib/escrow-wallet'
import { checkSignedPayment } from '@/lib/escrow-verify'
import { sameAddress, waitForTransaction } from '@/lib/nimiq-rpc'
import { nimToSats } from '@/lib/utils'

// @nimiq/core is WebAssembly and, for an over-budget accept, signs a real
// payout — Node runtime, not edge.
export const runtime = 'nodejs'
// A topup verification plus a possible payout can outrun the 10s default.
export const maxDuration = 60

// Accepting a proposal is the hinge of the whole marketplace: it names who the
// escrowed budget is earmarked for, opens the private chat, and closes the
// posting to further pitches. Usually nothing on-chain needs to move here —
// the money is already off the client's wallet and in the escrow account,
// funded at publication — but a bid that undercuts the budget triggers an
// automatic refund of the difference, and a bid that exceeds it requires the
// client to top up the escrow as part of this same request. See the `topup`
// and `excess refund` sections below.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; proposalId: string }> },
) {
  try {
    const { id, proposalId } = await params
    const user = await requireSession(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { action, currentBlock, serialized } = await request.json()

    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      include: {
        freelancer: { select: { id: true, address: true, displayName: true } },
        agreement: { include: { buyer: { select: { address: true, displayName: true } } } },
      },
    })

    if (!proposal || proposal.agreementId !== id) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
    }

    const opportunity = proposal.agreement
    const isClient = opportunity.buyerId === user.userId
    const isAuthor = proposal.freelancerId === user.userId

    if (action === 'withdraw') {
      if (!isAuthor) {
        return NextResponse.json({ error: 'Not your proposal' }, { status: 403 })
      }
      if (proposal.status === 'accepted') {
        return NextResponse.json(
          { error: 'An accepted proposal cannot be withdrawn — open a dispute instead' },
          { status: 400 },
        )
      }
      return NextResponse.json(
        await prisma.proposal.update({ where: { id: proposalId }, data: { status: 'withdrawn' } }),
      )
    }

    if (!isClient) {
      return NextResponse.json({ error: 'Only the client can decide on proposals' }, { status: 403 })
    }

    if (action === 'reject') {
      return NextResponse.json(
        await prisma.proposal.update({ where: { id: proposalId }, data: { status: 'rejected' } }),
      )
    }

    if (action !== 'accept') {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }

    if (opportunity.status !== 'open') {
      return NextResponse.json(
        { error: 'This opportunity already has a freelancer' },
        { status: 400 },
      )
    }
    if (proposal.status !== 'pending') {
      return NextResponse.json({ error: `This proposal was already ${proposal.status}` }, { status: 400 })
    }
    if (!opportunity.htlcHashRoot) {
      return NextResponse.json(
        { error: 'Commit the budget before accepting a proposal' },
        { status: 400 },
      )
    }

    const bid = Number(proposal.bidNIM)
    const funded = Number(opportunity.amountNIM)
    // Positive when the bid undercut the funded budget — refunded to the
    // client automatically below. Positive the other way when the bid
    // exceeds it — the client has to fund the gap as part of this request.
    const excess = Math.max(0, funded - bid)
    const topupNeeded = Math.max(0, bid - funded)

    let topupPayment: { txHash: string; fromAddress: string | null } | null = null

    if (topupNeeded > 0) {
      const escrowAddress = process.env.NIMIQ_ESCROW_ADDRESS
      if (!escrowAddress) {
        return NextResponse.json(
          { error: 'NIMIQ_ESCROW_ADDRESS is not configured — the server has nowhere to receive the top-up.' },
          { status: 500 },
        )
      }
      if (!serialized) {
        return NextResponse.json(
          {
            error: `This bid is ${topupNeeded.toFixed(2)} NIM above the funded budget. Fund the difference to accept it.`,
            topupNeeded,
          },
          { status: 400 },
        )
      }

      const expectedLuna = nimToSats(topupNeeded)
      const check = await checkSignedPayment(serialized, { escrowAddress, expectedLuna })
      if (!check.ok) {
        return NextResponse.json(
          { error: 'That top-up payment could not be verified', detail: check.reason },
          { status: 400 },
        )
      }

      // Decoding a signed transaction proves it was signed correctly — it does
      // not prove it was ever broadcast. Only the chain's own copy is the last
      // word on whether the money actually moved, exactly as `fund` insists on
      // before it will publish a posting.
      const skipVerification = process.env.NIMIQ_SKIP_ESCROW_VERIFICATION === 'true'
      if (skipVerification) {
        console.warn(
          'NIMIQ_SKIP_ESCROW_VERIFICATION=true — accepting a top-up without checking the chain. Never set this in production.',
        )
      } else {
        let onChain
        try {
          onChain = await waitForTransaction(check.payment!.txHash)
        } catch (err) {
          return NextResponse.json(
            {
              error: 'Could not reach the Nimiq network to confirm your top-up payment',
              detail: err instanceof Error ? err.message : String(err),
            },
            { status: 503 },
          )
        }
        if (!onChain) {
          // Broadcast but not yet in a block. Nothing failed — the client
          // should not sign or pay again, just retry this same accept with
          // the same signed transaction once it has landed.
          return NextResponse.json(
            {
              message:
                'Your top-up payment is broadcast and waiting to confirm on the network. Do not pay again — try accepting again in a moment.',
              pending: true,
              topupNeeded,
            },
            { status: 202 },
          )
        }
        if (!sameAddress(onChain.to, escrowAddress) || BigInt(Math.round(onChain.value)) < expectedLuna) {
          return NextResponse.json(
            { error: 'That top-up payment does not match what this proposal needs.' },
            { status: 400 },
          )
        }
      }

      topupPayment = { txHash: check.payment!.txHash, fromAddress: check.payment!.from }

      // The wallet dialog and the signature took real time. Re-read fresh,
      // immediately before locking, rather than trusting the state read at
      // the top of the request — the realistic race here is someone else's
      // proposal winning in that window, and by now the client has already
      // paid the top-up into escrow.
      const fresh = await prisma.agreement.findUnique({
        where: { id },
        select: { status: true },
      })
      const freshProposal = await prisma.proposal.findUnique({
        where: { id: proposalId },
        select: { status: true },
      })
      if (fresh?.status !== 'open' || freshProposal?.status !== 'pending') {
        let refunded = true
        try {
          await payFromEscrow({
            recipientAddress: opportunity.buyer.address,
            amountNIM: topupNeeded,
          })
        } catch (err) {
          refunded = false
          console.error(
            `[escrow] could not auto-refund a stranded top-up of ${topupNeeded} NIM for deal ${id} — an operator must send it back by hand:`,
            err,
          )
        }
        return NextResponse.json(
          {
            error: refunded
              ? 'Someone else was accepted first. Your top-up payment has been refunded rather than left in escrow.'
              : 'Someone else was accepted first, and your top-up payment could not be refunded automatically. An operator has been alerted and will send it back.',
          },
          { status: 409 },
        )
      }
    }

    const timeoutBlocks = parseInt(process.env.HTLC_TIMEOUT_BLOCKS || '14400', 10)
    // Recorded as the block after which an unresolved deal is treated as
    // abandoned and the escrow is refundable to the client.
    const head = Number.isFinite(Number(currentBlock)) ? Number(currentBlock) : 0
    const htlcTimeout = head + timeoutBlocks

    // Everything that defines the engagement moves together — a half-accepted
    // proposal would leave an opportunity that is neither open nor worked on.
    const [locked] = await prisma.$transaction([
      prisma.agreement.update({
        where: { id },
        data: {
          sellerId: proposal.freelancerId,
          // The escrow settles at what was actually agreed. If that is under
          // the funded budget, the difference is refunded below; if it is
          // over, the client has already topped it up above.
          amountNIM: bid,
          status: 'locked',
          lockedAt: new Date(),
          deadline: new Date(Date.now() + proposal.deliveryDays * 86400000),
          htlcTimeout,
        },
        include: {
          buyer: { select: { id: true, address: true, displayName: true } },
          seller: { select: { id: true, address: true, displayName: true } },
        },
      }),
      prisma.proposal.update({ where: { id: proposalId }, data: { status: 'accepted' } }),
      prisma.proposal.updateMany({
        where: { agreementId: id, status: 'pending', NOT: { id: proposalId } },
        data: { status: 'rejected' },
      }),
      prisma.message.create({
        data: {
          agreementId: id,
          senderId: user.userId,
          type: 'system',
          content: `${proposal.freelancer.displayName ?? 'The freelancer'} was accepted at ${bid} NIM, ${proposal.deliveryDays} days. Escrow is locking; this chat is now open and is retained as dispute evidence.`,
        },
      }),
    ])

    await recordEngagement([opportunity.buyerId, proposal.freelancerId])

    // The top-up payment already landed in escrow before the transaction
    // above; this just books it against the deal, the same way `fund` books
    // the initial payment. No payout involved — money only moved once, into
    // escrow, by the client's own signature.
    if (topupNeeded > 0 && topupPayment) {
      await prisma.escrowTransaction.create({
        data: {
          agreementId: id,
          type: 'topup',
          status: 'confirmed',
          txHash: topupPayment.txHash,
          fromAddress: topupPayment.fromAddress,
          amountNIM: topupNeeded,
          confirmedAt: new Date(),
        },
      })
    }

    // A bid under budget refunds the difference automatically — no client
    // action needed. A failure here must not undo the acceptance above: the
    // deal is already correctly locked, only the refund is outstanding, and
    // escrow-health monitoring picks up a stuck row from here.
    let refund: { amountNIM: number; ok: boolean; txHash?: string } | null = null
    if (excess > 0) {
      refund = await refundExcess({ agreementId: id, amountNIM: excess, clientAddress: opportunity.buyer.address })
    }

    return NextResponse.json({ opportunity: locked, refund })
  } catch (error) {
    console.error('Decide proposal error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Pays the client back the gap between what they funded and what the
// accepted bid actually costs. Reservation-guarded exactly like claim's
// payout (the unique constraint on (agreementId, type) makes a double refund
// impossible), and respects the same rolling ceiling every other payout out
// of this wallet does — counted against the broadest reasonable set of
// outgoing types, since undercounting is the unsafe direction here.
async function refundExcess({
  agreementId,
  amountNIM,
  clientAddress,
}: {
  agreementId: string
  amountNIM: number
  clientAddress: string
}): Promise<{ amountNIM: number; ok: boolean; txHash?: string }> {
  const dailyLimitNIM = Number(process.env.ESCROW_DAILY_LIMIT_NIM ?? '0')
  if (dailyLimitNIM > 0) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const recent = await prisma.escrowTransaction.aggregate({
      where: {
        type: { in: ['claim', 'refund', 'excess_refund'] },
        status: { in: ['confirmed', 'pending'] },
        createdAt: { gte: since },
      },
      _sum: { amountNIM: true },
    })
    const paidToday = Number(recent._sum.amountNIM ?? 0)
    if (paidToday + amountNIM > dailyLimitNIM) {
      console.error(
        `[escrow] DAILY LIMIT REACHED — refusing excess refund of ${amountNIM} NIM for deal ${agreementId}. ` +
          `${paidToday} NIM already paid in the last 24h against a ${dailyLimitNIM} NIM ceiling. ` +
          `The deal is locked correctly; only the refund is delayed.`,
      )
      return { amountNIM, ok: false }
    }
  }

  let reservation
  try {
    reservation = await prisma.escrowTransaction.create({
      data: { agreementId, type: 'excess_refund', status: 'pending', amountNIM },
    })
  } catch (err) {
    // Most likely a second accept request racing this one, caught by the
    // unique constraint. Either way, do not let a bookkeeping failure look
    // like a successful refund.
    console.error(`[escrow] could not reserve the excess refund for deal ${agreementId}:`, err)
    return { amountNIM, ok: false }
  }

  try {
    const payout = await payFromEscrow({ recipientAddress: clientAddress, amountNIM })
    await prisma.escrowTransaction.update({
      where: { id: reservation.id },
      data: { status: 'confirmed', txHash: payout.txHash, confirmedAt: new Date() },
    })
    return { amountNIM, ok: true, txHash: payout.txHash }
  } catch (err) {
    if (err instanceof EscrowConfigError) {
      await prisma.escrowTransaction.delete({ where: { id: reservation.id } })
    } else {
      await prisma.escrowTransaction.update({ where: { id: reservation.id }, data: { status: 'failed' } })
    }
    console.error(`[escrow] excess refund failed for deal ${agreementId}:`, err)
    return { amountNIM, ok: false }
  }
}
