// Server-side Nimiq RPC client.
//
// The mini app can ask a wallet to send a transaction, but a wallet's word is
// not proof — a client can call the API without ever opening the dialog. So the
// server checks the chain itself before it treats an opportunity as funded.
// Nothing here trusts anything the browser said about money.

const RPC_URL =
  process.env.NIMIQ_NETWORK === 'mainnet'
    ? process.env.NIMIQ_MAINNET_RPC_ENDPOINT
    : process.env.NIMIQ_RPC_ENDPOINT

export class RpcError extends Error {}

async function rpc<T>(method: string, params: unknown[] = []): Promise<T> {
  if (!RPC_URL) {
    throw new RpcError('No Nimiq RPC endpoint configured (NIMIQ_RPC_ENDPOINT).')
  }

  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    // A hung node must not hold a serverless function open to its own timeout.
    signal: AbortSignal.timeout(12000),
  })

  if (!res.ok) {
    throw new RpcError(`Nimiq RPC ${method} returned HTTP ${res.status}`)
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
  timestamp?: number
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
    return await rpc<ChainTransaction>('getTransactionByHash', [hash])
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
  return (await rpc<ChainTransaction[]>('getTransactionsByAddress', [address, max, null])) ?? []
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
