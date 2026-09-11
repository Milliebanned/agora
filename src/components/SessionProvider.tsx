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

  return (
    <SessionContext.Provider
      value={{
        user,
        role: user?.role ?? null,
        isPlatformMediator: Boolean(user?.isPlatformMediator),
        loading,
        refresh,
      }}
    >
      {children}
    </SessionContext.Provider>
  )
}
