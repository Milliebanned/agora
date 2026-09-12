'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
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
  /** The latest notifications, read or not, for the bell. */
  recent: NotificationRow[]
  /** Opening the notification list is the act of having seen them. */
  markAllRead: () => Promise<void>
  /** Clear one tab's dot. Called when its page is opened. */
  markTabRead: (tab: string) => Promise<void>
  /** Re-read the counts now, rather than waiting for the next poll. */
  refreshNotifications: () => Promise<void>
}

export interface NotificationRow {
  id: string
  tab: string
  type: string
  body: string
  href?: string | null
  createdAt: string
  /** Kept in the list once seen, shown quieter, so the history survives. */
  read?: boolean
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
  const pathname = usePathname()
  const [user, setUser] = useState<SessionUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [unread, setUnread] = useState<Record<string, number>>({})
  const [recent, setRecent] = useState<NotificationRow[]>([])

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
      const { counts, recent: rows } = await res.json()
      setUnread(counts ?? {})
      setRecent(rows ?? [])
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

  // Opening the page a notification is about is seeing it, and that is what
  // takes the dot off the tab. The delay is the difference between arriving
  // somewhere and passing through it: a redirect that lands on Deals on its
  // way to a deal should not count as having read what was waiting there.
  const markTabRead = useCallback(async (tab: string) => {
    setUnread((prev) => {
      if (!prev[tab]) return prev
      const next = { ...prev }
      delete next[tab]
      return next
    })
    setRecent((prev) => prev.map((n) => (n.tab === tab ? { ...n, read: true } : n)))
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tab }),
      })
    } catch {
      // Still unread server-side, so the dot comes back on the next poll.
    }
  }, [])

  useEffect(() => {
    if (!user) return
    // Only tabs that actually have something waiting, and only the one being
    // looked at. Matching on the record's own keys keeps this to the handful
    // of hrefs notifications are filed under.
    const here = Object.keys(unread).find(
      (href) => unread[href] > 0 && (pathname === href || pathname.startsWith(`${href}/`)),
    )
    if (!here) return
    const timer = setTimeout(() => markTabRead(here), 1200)
    return () => clearTimeout(timer)
  }, [pathname, unread, user, markTabRead])

  const markAllRead = useCallback(async () => {
    setUnread({})
    setRecent((prev) => prev.map((n) => ({ ...n, read: true })))
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ all: true }),
      })
    } catch {
      // They stay unread server-side and come back on the next poll.
    }
  }, [])

  return (
    <SessionContext.Provider
      value={{
        user,
        role: user?.role ?? null,
        isPlatformMediator: Boolean(user?.isPlatformMediator),
        loading,
        refresh,
        unread,
        recent,
        markAllRead,
        markTabRead,
        refreshNotifications: readNotifications,
      }}
    >
      {children}
    </SessionContext.Provider>
  )
}
