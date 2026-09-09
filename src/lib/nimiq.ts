// Nimiq SDK integration for NimTrust
// SPIKE TASK DAY 1: Validate exact SDK method names for HTLC transaction signing

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

// Which account the mock wallet pretends to be.
//
// A single hardcoded address made the mock useless for testing the actual
// product: the client and the freelancer would be the same person, so no
// proposal could ever be accepted. The address is therefore overridable per
// browser — open the app once with ?mock=NQ..., and that profile keeps that
// identity. Two browser profiles become two users.
//
// Point one of them at a real testnet address you control and the payout at the
// end of the flow arrives as real testnet NIM.
const DEFAULT_MOCK_ADDRESS = 'NQ07 0000 0000 0000 0000 0000 0000 0000 0000'
const MOCK_ADDRESS_KEY = 'nimtrust.mockAddress'

function mockAddress(): string {
  if (typeof window === 'undefined') return DEFAULT_MOCK_ADDRESS
  try {
    const fromQuery = new URLSearchParams(window.location.search).get('mock')
    if (fromQuery) {
      // URLSearchParams has already decoded this; decoding again would throw on
      // a literal percent sign.
      const cleaned = fromQuery.trim()
      window.localStorage.setItem(MOCK_ADDRESS_KEY, cleaned)
      return cleaned
    }
    return window.localStorage.getItem(MOCK_ADDRESS_KEY) || DEFAULT_MOCK_ADDRESS
  } catch {
    // Private browsing can throw on storage access; the default still works.
    return DEFAULT_MOCK_ADDRESS
  }
}

function mockNimiqProvider() {
  const address = mockAddress()
  return {
    listAccounts: async () => [address],
    sign: async (_message: string | { message: string; isHex?: boolean }) => ({
      publicKey: '0x' + '0'.repeat(64),
      signature: '0x' + '0'.repeat(128),
    }),
    isConsensusEstablished: async () => true,
    getBlockNumber: async () => 1,
    // No NIM moves. The server must be told to skip on-chain verification
    // (NIMIQ_SKIP_ESCROW_VERIFICATION=true) or funding will correctly refuse.
    sendBasicTransaction: async (_tx: { recipient: string; value: number }) =>
      'mock-transaction-not-on-chain',
  }
}

type NimiqLike = Awaited<ReturnType<typeof mockNimiqProvider>> | Record<string, any>

// Initialize Nimiq SDK (browser-side)
export async function initNimiq(): Promise<NimiqLike | null> {
  if (typeof window === 'undefined') return null

  if (MOCK_WALLET) {
    console.warn(
      `Using mock Nimiq wallet provider (NEXT_PUBLIC_MOCK_WALLET=true) — dev only. Acting as ${mockAddress()}. Override with ?mock=NQ...`,
    )
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

// SPIKE, SETTLED: @nimiq/mini-app-sdk v0.1.0 cannot create a contract.
//
// Its WALLET_METHODS whitelist is exactly: listAccounts, sign,
// sendBasicTransaction, sendBasicTransactionWithData, and the six staking
// methods. There is no HTLC creation, and `sign()` signs messages, not
// transactions. So a mini app can move NIM to an address and nothing more.
//
// What that buys us is still real: the client's payment into escrow is an
// ordinary on-chain transfer, it triggers the native Nimiq Pay confirmation,
// and the server verifies it against the chain before the posting goes live.

export interface BasicTransferRequest {
  recipient: string
  /** Amount in luna. 1 NIM = 100,000 luna. */
  value: number
  fee?: number
}

export interface TransferOutcome {
  ok: boolean
  /** The serialized transaction the wallet returns, when it returns one. */
  serialized?: string
  txHash?: string
  /** Why it did not go through, in words a person can act on. */
  reason?: string
}

// Ask the wallet to pay the escrow address. Nimiq Pay shows its own
// confirmation dialog; the user can refuse, and refusing is not an error.
export async function sendBasicTransaction(
  req: BasicTransferRequest,
): Promise<TransferOutcome> {
  const nimiq = await initNimiq()
  if (!nimiq) {
    return {
      ok: false,
      reason:
        'No Nimiq Pay wallet is connected. Open this Mini App inside Nimiq Pay — a desktop browser has no wallet to ask.',
    }
  }

  if (typeof (nimiq as Record<string, unknown>).sendBasicTransaction !== 'function') {
    return { ok: false, reason: 'This wallet does not support sending transactions.' }
  }

  try {
    const result = await nimiq.sendBasicTransaction({
      recipient: req.recipient,
      value: req.value,
      ...(req.fee !== undefined ? { fee: req.fee } : {}),
    })
    if (isError(result)) return { ok: false, reason: result.error.message }

    // The SDK types this as "the serialized transaction". Some builds return an
    // object carrying the hash instead, so accept both shapes.
    if (typeof result === 'string') return { ok: true, serialized: result }
    const asObject = result as { hash?: string; transactionHash?: string; serialized?: string }
    return {
      ok: true,
      txHash: asObject.hash ?? asObject.transactionHash,
      serialized: asObject.serialized,
    }
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : 'The transfer failed' }
  }
}

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
