// Nimiq SDK integration for NimTrust
// SPIKE TASK DAY 1: Validate exact SDK method names for HTLC transaction signing

import type { SessionJWT } from './types'

// The real SDK's init() waits for the native Nimiq Pay provider handshake,
// which never arrives outside the Nimiq Pay WebView (e.g. a desktop browser
// during local dev). NEXT_PUBLIC_MOCK_WALLET=true swaps in a fake provider
// so the wallet-connect flow is testable without a phone. Never set this in
// a deployed/production build.
const MOCK_WALLET = process.env.NEXT_PUBLIC_MOCK_WALLET === 'true'
const PROVIDER_TIMEOUT_MS = 8000

// SDK calls resolve to either the value or { error: { type, message } }.
type ErrorLike = { error: { type: string; message: string } }

function isError<T>(result: T | ErrorLike): result is ErrorLike {
  return Boolean(result) && typeof result === 'object' && 'error' in (result as object)
}

function mockNimiqProvider() {
  return {
    listAccounts: async () => ['NQ07 0000 0000 0000 0000 0000 0000 0000 0000'],
    sign: async (_message: string | { message: string; isHex?: boolean }) => ({
      publicKey: '0x' + '0'.repeat(64),
      signature: '0x' + '0'.repeat(128),
    }),
    isConsensusEstablished: async () => true,
    getBlockNumber: async () => 1,
  }
}

type NimiqLike = Awaited<ReturnType<typeof mockNimiqProvider>> | Record<string, any>

// Initialize Nimiq SDK (browser-side)
export async function initNimiq(): Promise<NimiqLike | null> {
  if (typeof window === 'undefined') return null

  if (MOCK_WALLET) {
    console.warn('Using mock Nimiq wallet provider (NEXT_PUBLIC_MOCK_WALLET=true) — dev only')
    return mockNimiqProvider()
  }

  try {
    const { init } = await import('@nimiq/mini-app-sdk')
    // init() resolves only once the native Nimiq Pay provider answers the
    // handshake. In an ordinary browser nothing ever answers, so race it
    // against a timeout rather than leaving the caller hanging forever.
    return await Promise.race([
      init(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), PROVIDER_TIMEOUT_MS)),
    ])
  } catch (err) {
    console.error('Failed to initialize Nimiq SDK:', err)
    return null
  }
}

// Get user's wallet addresses
export async function getAccounts(): Promise<string[]> {
  const nimiq = await initNimiq()
  if (!nimiq) return []

  try {
    const result = await nimiq.listAccounts()
    if (isError(result)) {
      console.error('listAccounts failed:', result.error.message)
      return []
    }
    // Types say string[], but tolerate [{ address }] shapes from the wallet.
    return (result as unknown[]).map((entry) =>
      typeof entry === 'string' ? entry : String((entry as { address?: string })?.address ?? entry),
    )
  } catch (err) {
    console.error('Failed to list accounts:', err)
    return []
  }
}

// Get current block number (for HTLC timeout calculation)
export async function getBlockNumber() {
  const nimiq = await initNimiq()
  if (!nimiq) return 0

  try {
    return await nimiq.getBlockNumber()
  } catch (err) {
    console.error('Failed to get block number:', err)
    return 0
  }
}

// Check if consensus is established (network synced)
export async function isConsensusEstablished() {
  const nimiq = await initNimiq()
  if (!nimiq) return false

  try {
    return await nimiq.isConsensusEstablished()
  } catch (err) {
    console.error('Failed to check consensus:', err)
    return false
  }
}

// Request device identifier (stable per-device SHA-256)
export async function requestDeviceIdentifier(reason: string) {
  const nimiq = await initNimiq()
  if (!nimiq) return null

  try {
    // @ts-ignore - SDK method may not be fully typed
    return await nimiq.requestDeviceIdentifier({ reason })
  } catch (err) {
    console.error('Failed to get device identifier:', err)
    return null
  }
}

// Build unsigned HTLC creation transaction
export async function buildHTLCCreationTx(
  buyerAddress: string,
  sellerAddress: string,
  amountNIM: number,
  hashRoot: string,
  timeoutBlocks: number,
) {
  try {
    // Nimiq HTLC data structure
    // recipient_type: 2 indicates HTLC account
    // The data bytes encode the HTLC parameters
    const htlcData = {
      sender: buyerAddress,
      recipient: sellerAddress,
      balance: BigInt(Math.floor(amountNIM * 1e5)), // 1 NIM = 100,000 lunar
      hash_root: hashRoot,
      hash_algorithm: 3, // SHA256 (1=Blake2b)
      hash_count: 1,
      timeout: timeoutBlocks,
    }

    return htlcData
  } catch (err) {
    console.error('Failed to build HTLC creation tx:', err)
    return null
  }
}

// Sign and send transaction (hands off to native Nimiq Pay dialog)
export async function signAndSendTransaction(txData: any) {
  if (typeof window === 'undefined') return null

  try {
    const nimiq = await initNimiq()
    if (!nimiq) return null

    // HTLC-specific signing path
    // The SDK should expose: nimiq.signTransaction(txData) or similar
    // This triggers the native Nimiq Pay confirmation dialog
    // User signs → transaction is broadcast → returns tx hash

    // Placeholder for SDK method (needs validation against real @nimiq/mini-app-sdk)
    // Expected signature: nimiq.sendTransaction(transaction) -> { hash: string }

    console.warn('signAndSendTransaction: Ensure Nimiq Pay is active in WebView context')

    // TODO: Replace with actual SDK call once validated:
    // const result = await nimiq.sendTransaction(txData)
    // return result

    return null // Return actual tx hash from SDK
  } catch (err) {
    console.error('Failed to sign and send transaction:', err)
    return null
  }
}

// Get current block height for HTLC timeout calculation
export async function getHTLCTimeout(daysFromNow: number = 10): Promise<number> {
  try {
    const blockNumber = await getBlockNumber()
    // Nimiq: ~4 blocks per minute, ~240 blocks per hour, ~5,760 blocks per day
    const blocksPerDay = 5760
    return blockNumber + daysFromNow * blocksPerDay
  } catch (err) {
    console.error('Failed to calculate HTLC timeout:', err)
    return 0
  }
}

// Claim HTLC funds with pre-image
export async function claimHTLC(
  htlcAddress: string,
  preImage: string,
) {
  try {
    // Build HTLC claim transaction
    // The claim must include the correct pre-image hash
    // Format: transaction to HTLC address with preImage as proof

    const claimTx = {
      to: htlcAddress,
      data: preImage,
      value: 0, // No value needed, just proof
    }

    return claimTx
  } catch (err) {
    console.error('Failed to build HTLC claim:', err)
    return null
  }
}

// Sign message for authentication challenge.
// The provider method is sign(), not signMessage(); it returns
// { publicKey, signature } or an ErrorResponse.
export async function signMessage(
  message: string,
): Promise<{ publicKey: string; signature: string } | null> {
  if (typeof window === 'undefined') return null

  try {
    const nimiq = await initNimiq()
    if (!nimiq) return null

    const result = await nimiq.sign(message)
    if (isError(result)) {
      console.error('sign failed:', result.error.message)
      return null
    }
    console.info('sign() returned:', JSON.stringify(result))
    // Types say { publicKey, signature }; some builds hand back a bare
    // signature string, so accept either.
    if (typeof result === 'string') {
      return { publicKey: '', signature: result }
    }
    const signed = result as { publicKey?: string; signature?: string; sig?: string }
    return {
      publicKey: signed.publicKey ?? '',
      signature: signed.signature ?? signed.sig ?? '',
    }
  } catch (err) {
    console.error('Failed to sign message:', err)
    return null
  }
}
