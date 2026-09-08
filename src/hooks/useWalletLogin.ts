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
        setError('Authentication failed. Please try again.')
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
