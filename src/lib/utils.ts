// Utility functions for Agora

import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Format NIM amount to human-readable string
export function formatNIM(sats: number | bigint): string {
  const decimals = 5 // NIM has 5 decimal places
  const value = typeof sats === 'bigint' ? Number(sats) : sats
  const nim = value / Math.pow(10, decimals)
  return `${nim.toFixed(2)} NIM`
}

// Convert NIM to satoshi units
export function nimToSats(nim: number): bigint {
  return BigInt(Math.floor(nim * 1e5))
}

// Shorten wallet address for display
export function shortAddress(address: string, chars: number = 6): string {
  if (!address) return ''
  return `${address.substring(0, chars)}...${address.substring(address.length - chars)}`
}

// Format date to readable string
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Calculate trust score (0-100) from reputation metrics
export function calculateTrustScore(
  totalAgreements: number,
  completedAgreements: number,
  disputeRate: number,
): number {
  if (totalAgreements === 0) return 50 // Default for new users

  const completionRate = (completedAgreements / totalAgreements) * 100
  const baseScore = completionRate * 0.8 + 20 // 0-100
  const disputePenalty = disputeRate * 2 // Each 1% dispute rate = -2 points
  return Math.max(0, Math.min(100, baseScore - disputePenalty))
}

// Generate a random hex string (for HTLC secrets)
export function randomHex(length: number = 32): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(length)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// Hash a string using SHA-256 (for HTLC hash root)
export async function sha256(str: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// Parse agreement JSON array field
export function parseJsonArray(jsonStr: string | undefined): string[] {
  if (!jsonStr) return []
  try {
    return JSON.parse(jsonStr)
  } catch {
    return []
  }
}
