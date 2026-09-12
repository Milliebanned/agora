'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
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
  /** Re-read the counts now, rather than waiting for the next poll. */
  refreshNotifications: () => Promise<void>
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
  // sleeps, and a missed socket would leave the badge permanently wrong. The
  // same reason it re-reads on focus — a phone that was asleep for an hour
  // should not show an hour-old count for another fifteen seconds.
  useEffect(() => {
    if (!user) return
    readNotifications()
    const timer = setInterval(readNotifications, 15_000)
    const onFocus = () => readNotifications()
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
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
        refreshNotifications: readNotifications,
      }}
    >
      {children}
    </SessionContext.Provider>
  )
}

// Clearing a tab's badge when you arrive at it — and only then.
//
// Marking it read on every render would wipe a notification that arrived while
// you were already sitting on the page, which looks exactly like the badge
// never working at all. Anything that lands while you are here keeps its badge
// until you come back to the tab, which is the only moment we can honestly say
// you went looking.
export function useClearTabOnArrival(tabs: { href: string }[]) {
  const { unread, markTabRead } = useSession()
  const pathname = usePathname()
  const lastCleared = useRef<string | null>(null)

  useEffect(() => {
    const match = tabs.find((t) => t.href !== '/dashboard' && pathname.startsWith(t.href))
    const href = match?.href ?? null
    if (!href) {
      lastCleared.current = null
      return
    }
    if (lastCleared.current === href) return
    lastCleared.current = href
    if (unread[href]) markTabRead(href)
    // `unread` is deliberately not a dependency: this runs when the tab you are
    // on changes, not when a count does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, markTabRead])
}
