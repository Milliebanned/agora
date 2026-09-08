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
// SPIKE: exact @nimiq/core API TBD based on Day 1 validation
export async function buildHTLCCreationTx(
  buyerAddress: string,
  sellerAddress: string,
  amountNIM: number,
  hashRoot: string,
  timeoutBlocks: number,
) {
  try {
    // Placeholder - will be filled in after SDK validation
    console.warn('buildHTLCCreationTx: awaiting SDK method validation (Day 1 spike)')
    return {
      type: 2, // HTLC account type
      sender: buyerAddress,
      recipient: sellerAddress,
      balance: BigInt(amountNIM * 1e5), // Convert NIM to sats
      hash_root: hashRoot,
      hash_algorithm: 3, // SHA256
      hash_count: 1,
      timeout: timeoutBlocks,
    }
  } catch (err) {
    console.error('Failed to build HTLC creation tx:', err)
    return null
  }
}

// Sign and send transaction (hands off to native Nimiq Pay dialog)
// SPIKE: exact SDK method signature TBD
export async function signAndSendTransaction(txData: any) {
  if (typeof window === 'undefined') return null

  try {
    const nimiq = await initNimiq()
    if (!nimiq) return null

    // Placeholder - will be filled in after SDK validation
    console.warn('signAndSendTransaction: awaiting SDK method validation (Day 1 spike)')
    // Expected flow: nimiq.signTransaction(txData) -> triggers native Nimiq Pay -> user approves -> tx broadcast
    return { hash: '0x...' } // Placeholder
  } catch (err) {
    console.error('Failed to sign and send transaction:', err)
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
