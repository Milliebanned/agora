// Nimiq SDK integration for NimTrust
// SPIKE TASK DAY 1: Validate exact SDK method names for HTLC transaction signing

import type { SessionJWT } from './types'

// Initialize Nimiq SDK (browser-side)
export async function initNimiq() {
  if (typeof window === 'undefined') return null

  try {
    const { init } = await import('@nimiq/mini-app-sdk')
    const nimiq = await init()
    return nimiq
  } catch (err) {
    console.error('Failed to initialize Nimiq SDK:', err)
    return null
  }
}

// Get user's wallet addresses
export async function getAccounts() {
  const nimiq = await initNimiq()
  if (!nimiq) return []

  try {
    return await nimiq.listAccounts()
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

// Sign message for authentication challenge
export async function signMessage(message: string) {
  if (typeof window === 'undefined') return null

  try {
    const nimiq = await initNimiq()
    if (!nimiq) return null

    // @ts-ignore - SDK method may not be fully typed
    const signature = await nimiq.signMessage(message)
    return signature
  } catch (err) {
    console.error('Failed to sign message:', err)
    return null
  }
}
