import { randomBytes } from 'node:crypto'
import prisma from './db'
import { verifyNimiqSignature } from './nimiq-signature'

// Wallet-signed actions.
//
// Agora holds other people's money, and until now the only thing standing
// between a session cookie and somebody else's escrow was that cookie. A
// signature raises that: the person has to be holding the wallet, in Nimiq
// Pay, at the moment the thing happens, and they have to have read what they
// were agreeing to, because the text they sign says it in plain words.
//
// It also makes the record worth something afterwards. "The client approved
// this" stops being a row this server wrote about itself and becomes a
// statement the client's own key signed, which is exactly what a dispute needs
// and what a database row can never be.

/** Every action that has to be signed, and what the wallet says it is doing. */
export const SIGNED_ACTIONS = {
  login: 'Sign in to Agora',
  // Money.
  claim_escrow: 'Claim the escrow for',
  approve_work: 'Approve the work and release the escrow for',
  accept_proposal: 'Accept this proposal and lock the escrow for',
  withdraw_posting: 'Withdraw and refund the escrow for',
  settle_dispute: 'Accept the mediator’s verdict for',
  // Commitments: things that put you on the hook to another person.
  submit_proposal: 'Submit a proposal for',
  submit_work: 'Submit the finished work for',
  post_job: 'Post this job on Agora',
  publish_ad: 'Publish this advertisement on Agora',
  open_dispute: 'Open a dispute on',
} as const

export type SignedAction = keyof typeof SIGNED_ACTIONS

/** Long enough to read the text and tap through a wallet dialog on a phone,
 *  short enough that a screen left open is not a standing authorisation. */
const TTL_MS = 5 * 60 * 1000

function normalise(address: string): string {
  return address.replace(/\s+/g, '').toUpperCase()
}

/**
 * The text the wallet shows. It has to be readable, because the whole point is
 * that somebody approves what it says rather than approving an opaque hash: it
 * names the action, the thing it applies to, the amount when money moves, and
 * carries the nonce that makes it good exactly once.
 */
function composeMessage(input: {
  action: SignedAction
  subject?: string | null
  amountNIM?: number | null
  address: string
  nonce: string
}): string {
  const lines = [`Agora: ${SIGNED_ACTIONS[input.action]}`]
  if (input.subject) lines.push(`"${input.subject}"`)
  if (typeof input.amountNIM === 'number' && input.amountNIM > 0) {
    lines.push(`Amount: ${input.amountNIM.toFixed(2)} NIM`)
  }
  lines.push('', `Wallet: ${input.address}`, `Nonce: ${input.nonce}`)
  return lines.join('\n')
}

export interface IssuedChallenge {
  nonce: string
  message: string
  expiresAt: string
}

export async function issueChallenge(input: {
  address: string
  action: SignedAction
  subjectId?: string | null
  /** The human name of the thing, for the wallet dialog: a job title, say. */
  subject?: string | null
  amountNIM?: number | null
}): Promise<IssuedChallenge> {
  const nonce = randomBytes(16).toString('hex')
  const address = normalise(input.address)
  const message = composeMessage({
    action: input.action,
    subject: input.subject,
    amountNIM: input.amountNIM,
    address: input.address,
    nonce,
  })
  const expiresAt = new Date(Date.now() + TTL_MS)

  await prisma.signatureChallenge.create({
    data: {
      nonce,
      address,
      action: input.action,
      subjectId: input.subjectId ?? null,
      message,
      expiresAt,
    },
  })

  // Swept here rather than on a schedule: issuing is the only moment this
  // table grows, so it is the natural moment to drop what has gone stale.
  prisma.signatureChallenge
    .deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - TTL_MS) } } })
    .catch(() => {
      // Housekeeping. A failure here must never fail the action.
    })

  return { nonce, message, expiresAt: expiresAt.toISOString() }
}

export interface SignatureProof {
  nonce?: unknown
  signature?: unknown
  publicKey?: unknown
}

export type ConsumeResult = { ok: true } | { ok: false; status: number; error: string }

/**
 * Spend a challenge, or explain why it cannot be spent.
 *
 * The checks are deliberately all made against what the server stored, never
 * against anything the caller sent alongside the signature. A caller can pick
 * which nonce to present; they cannot pick what it says it authorises.
 */
export async function consumeSignedAction(input: {
  proof: SignatureProof
  address: string
  action: SignedAction
  subjectId?: string | null
}): Promise<ConsumeResult> {
  const { nonce, signature, publicKey } = input.proof
  if (typeof nonce !== 'string' || typeof signature !== 'string' || typeof publicKey !== 'string') {
    return {
      ok: false,
      status: 400,
      error: 'This action has to be signed in your wallet.',
    }
  }

  const challenge = await prisma.signatureChallenge.findUnique({ where: { nonce } })
  if (!challenge) {
    return { ok: false, status: 400, error: 'That signing request is not one we issued.' }
  }
  if (challenge.usedAt) {
    return { ok: false, status: 409, error: 'That signature has already been used.' }
  }
  if (challenge.expiresAt.getTime() < Date.now()) {
    return { ok: false, status: 410, error: 'That signing request expired. Try again.' }
  }
  if (challenge.action !== input.action) {
    return { ok: false, status: 400, error: 'That signature was for a different action.' }
  }
  if ((challenge.subjectId ?? null) !== (input.subjectId ?? null)) {
    return { ok: false, status: 400, error: 'That signature was for something else.' }
  }
  if (challenge.address !== normalise(input.address)) {
    return { ok: false, status: 403, error: 'That signature was issued to a different wallet.' }
  }

  const verified = await verifyNimiqSignature({
    address: input.address,
    // The stored text, not anything the caller sent: otherwise somebody could
    // sign a harmless sentence and present it against a nonce that authorises
    // a payout.
    message: challenge.message,
    signature,
    publicKey,
  })
  if (!verified.ok) {
    return { ok: false, status: 401, error: verified.reason }
  }

  // Burned only once it has verified, and conditionally, so two requests
  // racing the same nonce cannot both come through: whichever update matches
  // an unused row wins and the other is told it was already spent.
  const burned = await prisma.signatureChallenge.updateMany({
    where: { nonce, usedAt: null },
    data: { usedAt: new Date() },
  })
  if (burned.count === 0) {
    return { ok: false, status: 409, error: 'That signature has already been used.' }
  }

  return { ok: true }
}
