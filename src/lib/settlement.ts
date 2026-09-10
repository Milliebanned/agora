// Dividing an escrow between the two parties and paying both legs on-chain.
//
// Two things can order this: a mediator's verdict both parties accepted, or a
// platform mediator's binding ruling. They differ entirely in who authorised
// them and not at all in how the money moves, so the money moves here, once,
// and each caller is left to decide only whether it is allowed to call.
//
// Every guard from the single-payout claim path applies, and for the same
// reasons: reserve each leg before signing, let the unique constraint on
// (agreementId, type) settle any race, respect the daily ceiling, and leave a
// payout that might have been broadcast alone for a human rather than retrying
// it into a double payment.

import { Prisma } from '@prisma/client'
import prisma from './db'
import { payFromEscrow, EscrowConfigError } from './escrow-wallet'

export type SettlementFailure =
  | 'daily_limit'
  | 'in_progress'
  | 'misconfigured'
  | 'payout_failed'

export interface SettlementLeg {
  who: 'freelancer' | 'client'
  amountNIM: number
  txHash: string
}

export type SettlementResult =
  | { ok: true; percent: number; paid: SettlementLeg[]; finalStatus: string }
  | { ok: false; failure: SettlementFailure; error: string; detail?: string; paid: SettlementLeg[] }

const DAILY_LIMIT_NIM = Number(process.env.ESCROW_DAILY_LIMIT_NIM ?? '0')

export interface SettlementRequest {
  agreementId: string
  /** Share of the escrow the freelancer receives, 0-100. */
  percent: number
  freelancerAddress: string
  clientAddress: string
  amountNIM: number
}

// Split the escrow and pay both sides. Returns rather than throws, because
// every failure here needs a different sentence in front of the user.
export async function settleEscrow(req: SettlementRequest): Promise<SettlementResult> {
  // Integer luna throughout, so a split can neither invent money nor strand a
  // fraction of it: the client's share is the remainder, by construction.
  const percent = Math.max(0, Math.min(100, Math.round(req.percent)))
  const totalLuna = Math.round(req.amountNIM * 1e5)
  const freelancerLuna = Math.floor((totalLuna * percent) / 100)
  const clientLuna = totalLuna - freelancerLuna

  const legs = (
    [
      { type: 'claim', recipient: req.freelancerAddress, luna: freelancerLuna, who: 'freelancer' },
      { type: 'refund', recipient: req.clientAddress, luna: clientLuna, who: 'client' },
    ] as const
  ).filter((leg) => leg.luna > 0)

  const paid: SettlementLeg[] = []

  if (DAILY_LIMIT_NIM > 0) {
    const outgoing = legs.reduce((sum, leg) => sum + leg.luna / 1e5, 0)
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const recent = await prisma.escrowTransaction.aggregate({
      where: {
        type: { in: ['claim', 'refund'] },
        status: { in: ['confirmed', 'pending'] },
        createdAt: { gte: since },
      },
      _sum: { amountNIM: true },
    })
    const paidToday = Number(recent._sum.amountNIM ?? 0)
    if (paidToday + outgoing > DAILY_LIMIT_NIM) {
      console.error(
        `[escrow] DAILY LIMIT REACHED — refusing settlement of ${outgoing} NIM for deal ${req.agreementId}. ${paidToday} NIM already paid in the last 24h against a ${DAILY_LIMIT_NIM} NIM ceiling.`,
      )
      return {
        ok: false,
        failure: 'daily_limit',
        error:
          'Payouts are temporarily paused for review. The decision is recorded and nothing was lost — the settlement completes once an operator lifts the pause.',
        paid,
      }
    }
  }

  for (const leg of legs) {
    const amountNIM = leg.luna / 1e5

    const already = await prisma.escrowTransaction.findFirst({
      where: { agreementId: req.agreementId, type: leg.type, status: 'confirmed' },
    })
    if (already) {
      paid.push({ who: leg.who, amountNIM, txHash: already.txHash ?? '' })
      continue
    }

    let reservation
    try {
      reservation = await prisma.escrowTransaction.create({
        data: { agreementId: req.agreementId, type: leg.type, status: 'pending', amountNIM },
      })
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return {
          ok: false,
          failure: 'in_progress',
          error: 'This settlement is already being paid out.',
          paid,
        }
      }
      throw err
    }

    try {
      const payout = await payFromEscrow({ recipientAddress: leg.recipient, amountNIM })
      await prisma.escrowTransaction.update({
        where: { id: reservation.id },
        data: { status: 'confirmed', txHash: payout.txHash, confirmedAt: new Date() },
      })
      paid.push({ who: leg.who, amountNIM, txHash: payout.txHash })
    } catch (err) {
      // A configuration error is raised before anything is signed, so the
      // reservation is released and the settlement can be retried once an
      // operator fixes it. Any other failure might have reached the network,
      // so the row stays `failed` and a human decides — reopening a payout
      // that may have gone out is how somebody gets paid twice.
      const isPreFlight = err instanceof EscrowConfigError
      if (isPreFlight) {
        await prisma.escrowTransaction.delete({ where: { id: reservation.id } })
      } else {
        await prisma.escrowTransaction.update({
          where: { id: reservation.id },
          data: { status: 'failed' },
        })
      }

      console.error(`[escrow] settlement leg (${leg.who}) failed for deal ${req.agreementId}:`, err)

      return {
        ok: false,
        failure: isPreFlight ? 'misconfigured' : 'payout_failed',
        error: isPreFlight
          ? 'The escrow wallet is misconfigured — the settlement is decided but cannot pay out until an operator fixes it.'
          : `The ${leg.who}'s share could not be paid. The decision stands and an operator has been alerted.`,
        detail: err instanceof Error ? err.message : String(err),
        paid,
      }
    }
  }

  // The terminal state that describes what actually happened to the money.
  const finalStatus = percent === 100 ? 'completed' : percent === 0 ? 'refunded' : 'settled'
  return { ok: true, percent, paid, finalStatus }
}
