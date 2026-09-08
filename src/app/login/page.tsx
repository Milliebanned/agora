'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getAccounts, signMessage } from '@/lib/nimiq'

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async () => {
    setLoading(true)
    setError('')

    try {
      // Get wallet address
      const accounts = await getAccounts()
      if (!accounts || accounts.length === 0) {
        setError('No wallet found. Please open in Nimiq Pay.')
        setLoading(false)
        return
      }

      const address = accounts[0]

      // Request challenge from server
      const challengeRes = await fetch('/api/auth/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      })

      const { challenge } = await challengeRes.json()

      // Sign the challenge
      const signature = await signMessage(challenge)
      if (!signature) {
        setError('Failed to sign message. Please try again.')
        setLoading(false)
        return
      }

      // Verify signature and get session
      const verifyRes = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, message: challenge, signature }),
        credentials: 'include',
      })

      if (!verifyRes.ok) {
        setError('Authentication failed. Please try again.')
        setLoading(false)
        return
      }

      // Redirect to dashboard
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-lg">
        <h1 className="text-3xl font-bold text-center mb-2">NimTrust</h1>
        <p className="text-center text-muted-foreground mb-8">
          AI-powered trust for P2P commerce on Nimiq
        </p>

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-accent text-accent-foreground py-3 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50"
        >
          {loading ? 'Connecting...' : 'Connect Wallet'}
        </button>

        {error && <p className="text-destructive text-sm mt-4 text-center">{error}</p>}

        <div className="mt-8 pt-8 border-t text-center text-sm text-muted-foreground">
          <p>💡 Open this in Nimiq Pay to get started</p>
        </div>
      </div>
    </div>
  )
}
