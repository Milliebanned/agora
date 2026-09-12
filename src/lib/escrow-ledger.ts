import prisma from './db'

// What actually happened to the money, read from the payments themselves.
//
// Every other count in the app is derived from a deal's status, which answers
// "how far along is this" and not "where is the money". Those two drift apart
// constantly and in ways that matter: an approved deal the freelancer has not
// claimed yet is not income, a withdrawn posting's budget left escrow but was
// never paid to anybody, and a mediated split is not the same event as being
// paid in full. EscrowTransaction rows are the only record of money moving, so
// they are what this counts.
//
// Only `confirmed` rows count. A pending payout is one that may still fail, and
// a failed one moved nothing.

/** Money out of the escrow wallet to the freelancer. */
const TO_FREELANCER = ['claim'] as const
/** Money out of the escrow wallet back to the client, by every route it can take. */
const TO_CLIENT = ['refund', 'excess_refund', 'withdraw_refund'] as const
/** Money into the escrow wallet from the client. */
const FROM_CLIENT = ['fund', 'topup'] as const

const LIVE = ['open', 'locked', 'submitted', 'disputed']

export interface FreelancerLedger {
  /** Paid out on deals that finished the normal way. */
  claimed: number
  /** Paid out on deals a mediator settled — usually a share, not the whole. */
  mediated: number
  /** Approved, and still sitting in escrow waiting for them to claim it. */
  awaitingClaim: number
}

export interface ClientLedger {
  /** Their money the escrow wallet is holding right now, still at stake. */
  inEscrow: number
  /** Approved and earmarked, but the freelancer has not collected it yet. No
   *  longer the client's to withdraw, and not yet paid either. */
  owedToFreelancers: number
  /** Left escrow and went to a freelancer. */
  paidOut: number
  /** Left escrow and came back to them — refunds, withdrawals, mediated returns. */
  returned: number
}

type TxRow = { type: string; status: string; amountNIM: unknown }

const sum = (rows: TxRow[], types: readonly string[]) =>
  rows
    .filter((t) => t.status === 'confirmed' && types.includes(t.type))
    .reduce((total, t) => total + Number(t.amountNIM ?? 0), 0)

export async function ledgerFor(userId: string): Promise<{
  freelancer: FreelancerLedger
  client: ClientLedger
}> {
  const deals = await prisma.agreement.findMany({
    where: { OR: [{ buyerId: userId }, { sellerId: userId }] },
    select: {
      buyerId: true,
      sellerId: true,
      status: true,
      amountNIM: true,
      escrowTransactions: { select: { type: true, status: true, amountNIM: true } },
      // A deal that went through mediation was settled, not simply completed —
      // the freelancer's side of that is worth showing apart from work that
      // ended by agreement.
      disputes: { select: { status: true } },
    },
  })

  const freelancer: FreelancerLedger = { claimed: 0, mediated: 0, awaitingClaim: 0 }
  const client: ClientLedger = { inEscrow: 0, owedToFreelancers: 0, paidOut: 0, returned: 0 }

  for (const deal of deals) {
    const tx = deal.escrowTransactions
    const toFreelancer = sum(tx, TO_FREELANCER)
    const toClient = sum(tx, TO_CLIENT)
    const fromClient = sum(tx, FROM_CLIENT)

    if (deal.sellerId === userId) {
      const mediated = deal.status === 'settled' || deal.disputes.some((d) => d.status === 'resolved')
      if (mediated) freelancer.mediated += toFreelancer
      else freelancer.claimed += toFreelancer

      // Approved but not yet collected. Counted from the deal rather than from
      // a payment, because the whole point is that no payment exists yet.
      if (deal.status === 'completed' && toFreelancer === 0) {
        freelancer.awaitingClaim += Number(deal.amountNIM)
      }
    }

    if (deal.buyerId === userId) {
      client.paidOut += toFreelancer
      client.returned += toClient
      // What is still held is what went in minus everything that has since come
      // out, counted only while the deal is live. Anything finished is either
      // paid or returned, and is already above.
      if (LIVE.includes(deal.status)) {
        client.inEscrow += Math.max(0, fromClient - toFreelancer - toClient)
      } else if (deal.status === 'completed' && toFreelancer === 0) {
        // Approved, so it is no longer theirs to withdraw, but nobody has been
        // paid yet either. Counting it as held would overstate what they can
        // still get back; counting it as paid would claim a payment that has
        // not happened.
        client.owedToFreelancers += Math.max(0, fromClient - toClient)
      }
    }
  }

  return { freelancer, client }
}
