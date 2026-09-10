// Server-side Nimiq RPC client.
//
// The mini app can ask a wallet to send a transaction, but a wallet's word is
// not proof — a client can call the API without ever opening the dialog. So the
// server checks the chain itself before it treats an opportunity as funded.
// Nothing here trusts anything the browser said about money.

import { rpcEndpoint, resolveNetwork } from './nimiq-network'

export class RpcError extends Error {}

async function rpc<T>(method: string, params: unknown[] = []): Promise<T> {
  // Resolved per call rather than at import: the endpoint depends on which
  // chain this deployment is on, and getting that wrong is the difference
  // between finding a payment and swearing it never happened.
  const RPC_URL = rpcEndpoint()

  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    // A hung node must not hold a serverless function open to its own timeout.
    signal: AbortSignal.timeout(12000),
  })

  if (!res.ok) {
    throw new RpcError(
      `Nimiq RPC ${method} returned HTTP ${res.status} (network: ${resolveNetwork()})`,
    )
  }

  const body = await res.json()
  if (body.error) {
    throw new RpcError(`Nimiq RPC ${method}: ${body.error.message ?? 'unknown error'}`)
  }

  // Albatross wraps results as { data, metadata }; older nodes return the value
  // directly. Accept either rather than guessing at the deployment.
  const result = body.result
  return (result && typeof result === 'object' && 'data' in result ? result.data : result) as T
}

export interface ChainTransaction {
  hash: string
  from: string
  to: string
  value: number // luna
  blockNumber?: number
  confirmations?: number
  /** Unix milliseconds. Normalised — see normaliseTx. */
  timestamp?: number
}

// Albatross nodes report transaction timestamps in milliseconds, but the field
// is bare `timestamp` and reads like seconds, which is how it came to be
// multiplied by 1000 at a call site and land in the year 58663. A comparison
// against that is not merely wrong, it is uselessly true, which silently
// disabled a guard on the payout path.
//
// Normalise once, here, so no caller has to know: anything below ~2001 in
// milliseconds must have been seconds.
const MS_THRESHOLD = 1e12

function normaliseTx<T extends { timestamp?: number }>(tx: T): T {
  if (typeof tx.timestamp === 'number' && tx.timestamp > 0 && tx.timestamp < MS_THRESHOLD) {
    return { ...tx, timestamp: tx.timestamp * 1000 }
  }
  return tx
}

export async function getBlockNumber(): Promise<number> {
  return rpc<number>('getBlockNumber')
}

// Broadcast a signed transaction. Returns the hash the node assigns it.
export async function sendRawTransaction(txHex: string): Promise<string> {
  return rpc<string>('sendRawTransaction', [txHex])
}

export interface ChainAccount {
  address: string
  balance: number // luna
}

export async function getAccountByAddress(address: string): Promise<ChainAccount> {
  return rpc<ChainAccount>('getAccountByAddress', [address])
}

export async function getTransactionByHash(hash: string): Promise<ChainTransaction | null> {
  try {
    const tx = await rpc<ChainTransaction>('getTransactionByHash', [hash])
    return tx ? normaliseTx(tx) : null
  } catch (err) {
    // A hash the node has not seen yet is a normal state right after a send,
    // not a failure worth throwing over.
    if (err instanceof RpcError && /not found|unknown/i.test(err.message)) return null
    throw err
  }
}

// Albatross declares this as (address, max: Option<u16>, start_at:
// Option<Blake2bHash>). Positional params must match that arity — sending only
// two is rejected with "Invalid params" — so the unused pagination cursor is
// passed explicitly as null.
export async function getTransactionsByAddress(
  address: string,
  max = 20,
): Promise<ChainTransaction[]> {
  const txs = (await rpc<ChainTransaction[]>('getTransactionsByAddress', [address, max, null])) ?? []
  return txs.map(normaliseTx)
}

// Wait for a transaction the node has not indexed yet.
//
// A payment sits in the mempool for a moment before any node will return it,
// and asking once — immediately after the wallet broadcasts — reliably finds
// nothing. That is not "the payment failed"; it is "we asked too early". Poll
// briefly rather than treating the first miss as an answer.
//
// The budget is kept well inside the route's own timeout: a caller that runs
// out of patience records the payment as pending and confirms it later, which
// is a far better outcome than holding the request open until it dies.
export async function waitForTransaction(
  hash: string,
  { attempts = 6, intervalMs = 2500 }: { attempts?: number; intervalMs?: number } = {},
): Promise<ChainTransaction | null> {
  for (let i = 0; i < attempts; i++) {
    try {
      const tx = await getTransactionByHash(hash)
      if (tx) return tx
    } catch (err) {
      // A node that is unreachable this second may answer the next. Only the
      // final attempt's failure is worth surfacing.
      if (i === attempts - 1) throw err
    }
    if (i < attempts - 1) await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
  return null
}

// Nimiq addresses are written with spaces in the UI but compared without them,
// and case varies between sources. Normalise before any equality check.
export function sameAddress(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false
  return a.replace(/\s+/g, '').toUpperCase() === b.replace(/\s+/g, '').toUpperCase()
}

export interface FundingCheck {
  ok: boolean
  reason?: string
  transaction?: ChainTransaction
}

// Did `from` really pay `expectedLuna` into the escrow address?
//
// Checked by hash when the wallet gave us one, and otherwise by scanning recent
// transfers into the escrow account — some wallets hand back a serialized
// transaction rather than its hash.
export async function verifyEscrowFunding(opts: {
  escrowAddress: string
  from: string
  expectedLuna: bigint
  txHash?: string | null
}): Promise<FundingCheck> {
  const matches = (tx: ChainTransaction) =>
    sameAddress(tx.to, opts.escrowAddress) &&
    sameAddress(tx.from, opts.from) &&
    BigInt(Math.round(tx.value)) >= opts.expectedLuna

  if (opts.txHash) {
    const tx = await getTransactionByHash(opts.txHash)
    if (!tx) return { ok: false, reason: 'The node has not seen that transaction yet.' }
    if (!sameAddress(tx.to, opts.escrowAddress))
      return { ok: false, reason: 'That transaction did not pay the escrow address.' }
    if (!sameAddress(tx.from, opts.from))
      return { ok: false, reason: 'That transaction came from a different wallet.' }
    if (BigInt(Math.round(tx.value)) < opts.expectedLuna)
      return { ok: false, reason: 'That transaction paid less than the budget.' }
    return { ok: true, transaction: tx }
  }

  const recent = await getTransactionsByAddress(opts.escrowAddress, 50)
  const found = recent.find(matches)
  return found
    ? { ok: true, transaction: found }
    : { ok: false, reason: 'No matching payment into the escrow address was found on chain.' }
}
