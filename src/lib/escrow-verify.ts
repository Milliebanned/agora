// Reading a client's escrow payment out of what their wallet handed back.
//
// Nimiq Pay's sendBasicTransaction resolves with the *serialized transaction*,
// not its hash. That serialized blob is signed by the client's own key, so it
// is not a claim we have to take on trust — it is evidence. Deserializing it
// tells us who paid, who they paid, how much, and what the transaction's hash
// will be, all before the network has seen it.
//
// That last part is what makes it worth doing. A payment is broadcast and then
// spends a moment in the mempool before any node will admit it exists, and a
// funding check that runs in that window finds nothing. Recovering the hash
// here means the payment can be recorded the instant it is made and confirmed
// against the chain afterwards, instead of being lost because we asked too
// early.

if (typeof window !== 'undefined') {
  throw new Error('escrow-verify is server-only and must never be imported into client code')
}

import { networkId, NETWORK_IDS } from './nimiq-network'

type NimiqCore = typeof import('@nimiq/core')

let corePromise: Promise<NimiqCore> | null = null

function loadCore(): Promise<NimiqCore> {
  if (!corePromise) corePromise = import('@nimiq/core')
  return corePromise
}

export interface DecodedPayment {
  txHash: string
  from: string
  to: string
  valueLuna: bigint
  /** The chain this transaction was signed for. */
  networkId: number
}

export class PaymentDecodeError extends Error {}

// Recover a payment from the serialized transaction the wallet returned.
export async function decodeSignedPayment(serialized: string): Promise<DecodedPayment> {
  const core = await loadCore()

  let tx
  try {
    tx = core.Transaction.fromAny(serialized)
  } catch (err) {
    throw new PaymentDecodeError(
      `The wallet returned something that is not a readable transaction: ${
        err instanceof Error ? err.message : String(err)
      }`,
    )
  }

  return {
    txHash: tx.hash(),
    from: tx.sender.toUserFriendlyAddress(),
    to: tx.recipient.toUserFriendlyAddress(),
    valueLuna: BigInt(tx.value),
    networkId: Number(tx.networkId),
  }
}

export interface PaymentExpectation {
  escrowAddress: string
  payerAddress: string
  expectedLuna: bigint
}

export interface PaymentCheck {
  ok: boolean
  reason?: string
  payment?: DecodedPayment
}

// Does this signed transaction actually pay what this posting's budget requires?
//
// Checked against the database's idea of the deal, never against anything else
// in the request. A transaction that pays the wrong address, comes from the
// wrong wallet, or underpays is rejected before it is recorded — recording it
// would let a client publish a 500 NIM posting by paying 1 NIM.
export async function checkSignedPayment(
  serialized: string,
  expect: PaymentExpectation,
): Promise<PaymentCheck> {
  let payment: DecodedPayment
  try {
    payment = await decodeSignedPayment(serialized)
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) }
  }

  // The wallet signed this for a specific chain. If that is not the chain this
  // deployment verifies against, nothing downstream can ever find the payment —
  // it exists, on a chain we are not looking at. Catching it here turns a
  // permanent silent failure into one sentence that names the cause.
  let configuredNetworkId: number | null = null
  try {
    configuredNetworkId = networkId()
  } catch {
    // Network misconfiguration is reported by the caller's own config checks;
    // do not let it mask a payment problem here.
  }
  if (configuredNetworkId !== null && payment.networkId !== configuredNetworkId) {
    const name = (id: number) =>
      id === NETWORK_IDS.mainnet ? 'mainnet' : id === NETWORK_IDS.testnet ? 'testnet' : `network ${id}`
    return {
      ok: false,
      reason:
        `That payment was signed for ${name(payment.networkId)}, but this deployment is ` +
        `configured for ${name(configuredNetworkId)}. The payment is real, but it is on a ` +
        `chain this server does not check. Fix NIMIQ_NETWORK before paying again.`,
      payment,
    }
  }

  const normalise = (a: string) => a.replace(/\s+/g, '').toUpperCase()

  if (normalise(payment.to) !== normalise(expect.escrowAddress)) {
    return { ok: false, reason: 'That transaction does not pay the escrow address.', payment }
  }
  if (normalise(payment.from) !== normalise(expect.payerAddress)) {
    return { ok: false, reason: 'That transaction was sent from a different wallet.', payment }
  }
  if (payment.valueLuna < expect.expectedLuna) {
    return { ok: false, reason: 'That transaction pays less than the posted budget.', payment }
  }

  return { ok: true, payment }
}
