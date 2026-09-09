'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Home, FileText, Scale, User, Lock, LogOut, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

// NimTrust runs inside the Nimiq Pay WebView, so the phone is the primary
// target, not a fallback. The desktop sidebar is replaced here by a top bar
// for identity and the primary action, and a thumb-reachable bottom tab bar.
const TABS = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/dashboard/agreements', label: 'Agreements', icon: FileText },
  { href: '/dashboard/disputes', label: 'Disputes', icon: Scale },
  { href: '/dashboard/profile', label: 'Profile', icon: User },
]

export function MobileTopBar() {
  const router = useRouter()

  const disconnect = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {})
    router.push('/')
  }

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur-xl lg:hidden">
      <Link href="/dashboard" className="flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded bg-accent">
          <Lock className="h-3.5 w-3.5 text-accent-foreground" strokeWidth={2.5} />
        </div>
        <span className="text-[15px] font-medium tracking-body">NimTrust</span>
      </Link>

      <div className="flex items-center gap-1">
        <Link href="/dashboard/agreements/create">
          <span className="flex h-8 items-center gap-1.5 rounded-md bg-accent px-3 text-[13px] font-medium text-accent-foreground">
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            New
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

export function MobileTabBar() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-border bg-background/95 backdrop-blur-xl lg:hidden"
      // Keeps the bar clear of the home indicator on notched phones.
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {TABS.map((tab) => {
        const active =
          tab.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(tab.href)
        return (
          <Link key={tab.href} href={tab.href}>
            <span
              className={cn(
                'flex h-14 flex-col items-center justify-center gap-1 transition-colors',
                active ? 'text-accent' : 'text-muted-foreground',
              )}
            >
              <tab.icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.4 : 2} />
              <span className="text-[10px] leading-none">{tab.label}</span>
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
