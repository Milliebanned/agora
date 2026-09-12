'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { useSession } from '@/components/SessionProvider'
import { navForRole, primaryActionForRole } from '@/lib/roles'
import { cn } from '@/lib/utils'

// Agora runs inside the Nimiq Pay WebView, so the phone is the primary
// target, not a fallback. The desktop sidebar is replaced here by a top bar
// for identity and the primary action, and a thumb-reachable bottom tab bar.

export function MobileTopBar() {
  const router = useRouter()
  const { role } = useSession()

  const primary = primaryActionForRole(role)
  const PrimaryIcon = primary.icon

  const disconnect = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {})
    router.push('/')
  }

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur-xl lg:hidden">
      <Link href="/dashboard" className="flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" className="h-6 w-6" />
        <span className="text-[15px] font-medium tracking-body">Agora</span>
      </Link>

      <div className="flex items-center gap-1">
        <Link href={primary.href}>
          <span className="flex h-8 items-center gap-1.5 rounded-md bg-[#3bb143] px-3 text-[13px] font-medium text-white">
            <PrimaryIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
            {primary.shortLabel}
          </span>
        </Link>
        <button
          onClick={disconnect}
          aria-label="Disconnect wallet"
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-white/[0.04] hover:text-destructive"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  )
}

// A dot rather than a number: a tab bar item is too small to read a count on,
// and "something is waiting here" is the whole message anyway.
function TabDot() {
  return (
    <span className="absolute right-[22%] top-[10px] h-2 w-2 rounded-full bg-[#3bb143] ring-2 ring-background" />
  )
}

export function MobileTabBar() {
  const pathname = usePathname()
  const { role, unread, markTabRead } = useSession()

  const tabs = navForRole(role)

  // Being on a tab means having seen what was waiting under it.
  useEffect(() => {
    const match = tabs.find((t) => t.href !== '/dashboard' && pathname.startsWith(t.href))
    if (match && unread[match.href]) markTabRead(match.href)
  }, [pathname, tabs, unread, markTabRead])

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 grid border-t border-border bg-background/95 backdrop-blur-xl lg:hidden"
      style={{
        // Tab count varies by role, so the track is set here rather than with a
        // grid-cols-N class Tailwind would have to know about ahead of time.
        gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))`,
        // Keeps the bar clear of the home indicator on notched phones.
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {tabs.map((tab) => {
        const active =
          tab.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(tab.href)
        return (
          <Link key={tab.href} href={tab.href}>
            <span
              className={cn(
                'flex h-14 flex-col items-center justify-center gap-1 px-0.5 transition-colors',
                active ? 'text-[#3bb143]' : 'text-muted-foreground',
              )}
            >
              <tab.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={active ? 2.4 : 2} />
              <span className="max-w-full truncate text-[10px] leading-none">{tab.label}</span>
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
