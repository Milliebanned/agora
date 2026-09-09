// The escrow wallet: the one place in this codebase that can move money.
//
// This is an ordinary Nimiq account whose private key the server holds, and it
// is the weakest point in the whole system by construction — whoever holds that
// key can drain every budget currently in escrow. Two consequences shape this
// file. First, it does one thing: pay a named recipient a named amount. There
// is deliberately no "sign this arbitrary transaction" export, so a bug
// elsewhere cannot borrow it to sign something else. Second, it refuses to
// start if the key does not derive to the address the rest of the app believes
// the escrow lives at — a mismatched key is a misconfiguration that must fail
// loudly at the first payout, not silently pay out of some other account.
//
// Before mainnet with real users, this should not run on the same host as the
// web app. See ESCROW.md.

import { getBlockNumber, sendRawTransaction, sameAddress } from './nimiq-rpc'

// Bundling this into a client component would ship the key-reading code to the
// browser. It cannot happen through any current import path, and this makes
// sure it stays that way rather than trusting that it will.
if (typeof window !== 'undefined') {
  throw new Error('escrow-wallet is server-only and must never be imported into client code')
}

type NimiqCore = typeof import('@nimiq/core')

let corePromise: Promise<NimiqCore> | null = null

// The WASM module is heavy and must not be loaded for requests that never pay
// anyone, so it is imported on first use rather than at module scope.
function loadCore(): Promise<NimiqCore> {
  if (!corePromise) corePromise = import('@nimiq/core')
  return corePromise
}

export class EscrowConfigError extends Error {}
export class EscrowPayoutError extends Error {}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new EscrowConfigError(`${name} is not set`)
  return value
}

// Nimiq network ids, confirmed against @nimiq/core: signing a transaction with
// 24 reports network "mainalbatross", and 5 reports "testalbatross". A wrong
// value fails safe anyway — the network rejects the transaction as invalid
// rather than paying the wrong person.
const NETWORK_IDS: Record<string, number> = {
  mainnet: 24, // MainAlbatross
  testnet: 5, // TestAlbatross
}

function networkId(): number {
  const explicit = process.env.NIMIQ_NETWORK_ID
  if (explicit) {
    const parsed = Number(explicit)
    if (!Number.isInteger(parsed)) {
      throw new EscrowConfigError(`NIMIQ_NETWORK_ID must be an integer, got "${explicit}"`)
    }
    return parsed
  }
  const network = process.env.NEXT_PUBLIC_NIMIQ_NETWORK ?? 'testnet'
  const id = NETWORK_IDS[network]
  if (id === undefined) {
    throw new EscrowConfigError(
      `Unknown network "${network}". Set NIMIQ_NETWORK_ID explicitly.`,
    )
  }
  return id
}

interface LoadedWallet {
  keyPair: InstanceType<NimiqCore['KeyPair']>
  address: string
}

let walletPromise: Promise<LoadedWallet> | null = null

async function loadWallet(): Promise<LoadedWallet> {
  if (walletPromise) return walletPromise

  walletPromise = (async () => {
    const core = await loadCore()
    const configuredAddress = requireEnv('NIMIQ_ESCROW_ADDRESS')
    const privateKeyHex = requireEnv('NIMIQ_ESCROW_PRIVATE_KEY').trim()

    let keyPair: InstanceType<NimiqCore['KeyPair']>
    try {
      keyPair = core.KeyPair.derive(core.PrivateKey.fromHex(privateKeyHex))
    } catch {
      // Never echo the value back — it would land in logs.
      throw new EscrowConfigError(
        'NIMIQ_ESCROW_PRIVATE_KEY is not a valid Nimiq private key (expected 64 hex characters).',
      )
    }

    const derived = keyPair.toAddress().toUserFriendlyAddress()
    if (!sameAddress(derived, configuredAddress)) {
      throw new EscrowConfigError(
        `NIMIQ_ESCROW_PRIVATE_KEY does not belong to NIMIQ_ESCROW_ADDRESS. The key controls ${derived}. Refusing to sign.`,
      )
    }

    return { keyPair, address: derived }
  })()

  // A failed load must not be cached, or one bad boot poisons the process.
  walletPromise.catch(() => {
    walletPromise = null
  })

  return walletPromise
}

// Confirms the key is present and matches its address, without paying anyone.
// Used by the health check so a misconfiguration surfaces before someone is
// waiting on money.
export async function assertEscrowWalletReady(): Promise<{ address: string }> {
  const { address } = await loadWallet()
  return { address }
}

export interface PayoutRequest {
  /** Must come from the database, never from a request body. */
  recipientAddress: string
  amountNIM: number
  /** Network fee in luna. Defaults to ESCROW_PAYOUT_FEE_LUNA. */
  feeLuna?: number
}

// Nimiq's base fee is zero and transfers are normally free, but a zero-fee
// transaction has no priority if the network is ever busy — it can sit
// unconfirmed, which on a payout route reads to the freelancer as "my money
// vanished". Configurable so it can be raised without a deploy.
function defaultFeeLuna(): number {
  const configured = Number(process.env.ESCROW_PAYOUT_FEE_LUNA ?? '0')
  return Number.isFinite(configured) && configured >= 0 ? configured : 0
}

export interface PayoutResult {
  txHash: string
  amountNIM: number
  recipientAddress: string
}

// Pay a freelancer out of escrow. The only money-moving function in the app.
export async function payFromEscrow(req: PayoutRequest): Promise<PayoutResult> {
  if (!Number.isFinite(req.amountNIM) || req.amountNIM <= 0) {
    throw new EscrowPayoutError('Payout amount must be a positive number of NIM')
  }

  const core = await loadCore()
  const { keyPair } = await loadWallet()

  let recipient: InstanceType<NimiqCore['Address']>
  try {
    recipient = core.Address.fromUserFriendlyAddress(req.recipientAddress)
  } catch {
    throw new EscrowPayoutError(`"${req.recipientAddress}" is not a valid Nimiq address`)
  }

  // Validity is anchored to the current head, so a transaction that fails to
  // broadcast expires instead of lingering as a surprise payment later.
  const head = await getBlockNumber()

  const transaction = core.TransactionBuilder.newBasic(
    keyPair.toAddress(),
    recipient,
    BigInt(Math.round(req.amountNIM * 1e5)), // luna
    BigInt(req.feeLuna ?? defaultFeeLuna()),
    head,
    networkId(),
  )

  // The second argument is the inner key pair used for staking transactions;
  // a basic transfer has no inner signer.
  transaction.sign(keyPair, undefined)

  const txHash = await sendRawTransaction(transaction.toHex())

  return {
    txHash: txHash || transaction.hash(),
    amountNIM: req.amountNIM,
    recipientAddress: req.recipientAddress,
  }
}
