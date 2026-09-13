'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getAccounts, signMessage } from '@/lib/nimiq'
import { detectNimiqPay, openInNimiqPay } from '@/lib/nimiq-pay-link'

export function useWalletLogin() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // Told apart from other failures on purpose: there is nothing to retry and
  // nothing the person did wrong, they just do not have the app yet.
  const [walletMissing, setWalletMissing] = useState(false)

  const connectWallet = async () => {
    setLoading(true)
    setError('')
    setWalletMissing(false)

    try {
      // Settled before asking the SDK, which waits ten seconds for a provider
      // before conceding there is none. Outside the app that is ten seconds of
      // nothing happening, and the answer is already known by then.
      if (!(await detectNimiqPay())) {
        // On a phone, hand the visitor to the app. Anywhere else, or if that
        // was already tried, say plainly what is needed.
        if (openInNimiqPay()) return
        setWalletMissing(true)
        setLoading(false)
        return
      }

      const accounts = await getAccounts()
      if (!accounts || accounts.length === 0) {
        // No provider, so this is a browser rather than the app. On a phone,
        // ask the operating system to reopen this site inside Nimiq Pay: if it
        // is installed it takes over from here and the wallet is simply there.
        // If that was already tried, or this is a desktop, fall through to the
        // instructions instead of bouncing somebody out to a dead end twice.
        if (openInNimiqPay()) return
        setWalletMissing(true)
        setLoading(false)
        return
      }

      const address = accounts[0]

      const challengeRes = await fetch('/api/auth/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      })

      const { challenge, nonce } = await challengeRes.json()

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
          // The nonce, not the text: the server verifies against the copy it
          // stored, so a client cannot present a signature of its own sentence.
          nonce,
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

      // A wallet that has never picked a marketplace side lands on /onboarding
      // to choose between offering and requiring a service.
      const { user } = await verifyRes.json().catch(() => ({ user: null }))
      router.push(user?.role ? '/dashboard' : '/onboarding')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setLoading(false)
    }
  }

  return { connectWallet, loading, error, walletMissing }
}
