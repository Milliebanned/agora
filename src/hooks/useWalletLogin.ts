'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getAccounts, signMessage } from '@/lib/nimiq'

export function useWalletLogin() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const connectWallet = async () => {
    setLoading(true)
    setError('')

    try {
      const accounts = await getAccounts()
      if (!accounts || accounts.length === 0) {
        setError('No wallet found. Please open in Nimiq Pay.')
        setLoading(false)
        return
      }

      const address = accounts[0]

      const challengeRes = await fetch('/api/auth/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      })

      const { challenge } = await challengeRes.json()

      const signed = await signMessage(challenge)
      if (!signed) {
        setError('Failed to sign message. Please try again.')
        setLoading(false)
        return
      }

      // The SDK's published types promise { publicKey, signature }; on-device
      // it may not match. Report the real shape rather than silently sending
      // undefined and getting a "Missing fields" rejection.
      if (!signed.signature) {
        setError(
          `Wallet returned an unexpected shape. account=${JSON.stringify(address).slice(0, 80)} signed=${JSON.stringify(signed).slice(0, 200)}`,
        )
        setLoading(false)
        return
      }

      const verifyRes = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          message: challenge,
          signature: signed.signature,
          publicKey: signed.publicKey,
        }),
        credentials: 'include',
      })

      if (!verifyRes.ok) {
        const detail = await verifyRes.text().catch(() => '')
        setError(`Authentication failed (${verifyRes.status}). ${detail.slice(0, 300)}`)
        setLoading(false)
        return
      }

      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setLoading(false)
    }
  }

  return { connectWallet, loading, error }
}
