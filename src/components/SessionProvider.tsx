'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { UserRole } from '@/lib/types'

export interface SessionUser {
  id: string
  address: string
  displayName?: string | null
  role?: UserRole | null
  isPlatformMediator?: boolean
}

interface SessionValue {
  user: SessionUser | null
  role: UserRole | null
  isPlatformMediator: boolean
  loading: boolean
  /** Re-read the session. Called after a role switch so every consumer follows. */
  refresh: () => Promise<void>
  /** Unread count per nav href, for the badge next to each tab. */
  unread: Record<string, number>
  /** Opening a tab is the act of having seen what was waiting under it. */
  markTabRead: (tab: string) => Promise<void>
}

const SessionContext = createContext<SessionValue | null>(null)

// Role decides what the whole dashboard leads with, so it lives in exactly one
// place. A second copy of it anywhere is a second thing that can go stale the
// moment someone switches sides from their profile.
export function useSession(): SessionValue {
  const value = useContext(SessionContext)
  if (!value) throw new Error('useSession must be used inside <SessionProvider>')
  return value
}

export default function SessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [user, setUser] = useState<SessionUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [unread, setUnread] = useState<Record<string, number>>({})

  const read = useCallback(
    async (redirectWhenRoleless: boolean) => {
      try {
        const res = await fetch('/api/auth/session', { credentials: 'include' })
        // A failed read leaves the last known session in place rather than
        // blanking the UI; the individual pages already handle their own 401s.
        if (!res.ok) return
        const { user: next } = await res.json()
        setUser(next ?? null)
        // A platform mediator is neither side of the marketplace, so making them
        // declare one before they can reach a dispute queue is a question with
        // no honest answer.
        if (redirectWhenRoleless && !next?.role && !next?.isPlatformMediator) {
          router.replace('/onboarding')
        }
      } catch {
        // Offline or a dropped request: same as above, keep what we have.
      } finally {
        setLoading(false)
      }
    },
    [router],
  )

  useEffect(() => {
    read(true)
  }, [read])

  const refresh = useCallback(() => read(false), [read])

  const readNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications', { credentials: 'include' })
      if (!res.ok) return
      const { counts } = await res.json()
      setUnread(counts ?? {})
    } catch {
      // A badge that fails to load is not worth surfacing to anyone.
    }
  }, [])

  // Polled rather than pushed: the dashboard is a WebView on a phone that
  // sleeps, and a missed socket would leave the badge permanently wrong.
  useEffect(() => {
    if (!user) return
    readNotifications()
    const timer = setInterval(readNotifications, 30_000)
    return () => clearInterval(timer)
  }, [user, readNotifications])

  const markTabRead = useCallback(
    async (tab: string) => {
      // Clear it locally first; the badge should go the moment the page opens,
      // not a round trip later.
      setUnread((prev) => (prev[tab] ? { ...prev, [tab]: 0 } : prev))
      try {
        await fetch('/api/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ tab }),
        })
      } catch {
        // It stays unread server-side and comes back on the next poll.
      }
    },
    [],
  )

  return (
    <SessionContext.Provider
      value={{
        user,
        role: user?.role ?? null,
        isPlatformMediator: Boolean(user?.isPlatformMediator),
        loading,
        refresh,
        unread,
        markTabRead,
      }}
    >
      {children}
    </SessionContext.Provider>
  )
}
