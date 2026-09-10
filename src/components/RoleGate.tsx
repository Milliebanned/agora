'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Renders nothing. Keeps every dashboard page behind the marketplace-side
// choice: a wallet that connected before roles existed (or that abandoned
// /onboarding halfway) gets sent back to pick one.
export default function RoleGate() {
  const router = useRouter()

  useEffect(() => {
    let cancelled = false
    fetch('/api/auth/session', { credentials: 'include' })
      .then(async (res) => {
        if (cancelled || !res.ok) return
        const { user } = await res.json()
        // A platform mediator is neither side of the marketplace, so making
        // them declare one before they can reach a dispute queue is a question
        // with no honest answer. They can still pick a role later if they also
        // want to trade.
        if (!user?.role && !user?.isPlatformMediator) router.replace('/onboarding')
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [router])

  return null
}
