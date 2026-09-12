'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { useSession } from '@/components/SessionProvider'
import NotificationBell from '@/components/NotificationBell'
import ThemeToggle from '@/components/ThemeToggle'
import UnreadDot from '@/components/ui/unread-dot'
import { navForRole, primaryActionForRole, roleLabel } from '@/lib/roles'
import { cn, shortAddress } from '@/lib/utils'

// The rail sits on the card surface rather than the page's own, so it reads as
// a panel the content scrolls beside. That is one class doing the work in both
// themes: against the page it is lighter in the light theme and lighter again
// in the dark one, which is the separation the design needs either way.
export default function Sidebar() {
  const pathname = usePathname()
  const { user, role, unread } = useSession()
  const router = useRouter()

  const nav = navForRole(role)
  const primary = primaryActionForRole(role)
  const PrimaryIcon = primary.icon

  const disconnect = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {})
    router.push('/')
  }

  const name = user?.displayName?.trim() || (user ? shortAddress(user.address) : '')
  const initial = (user?.displayName?.trim() || 'A').charAt(0).toUpperCase()

  return (
    <nav className="sticky top-0 hidden h-screen w-[232px] shrink-0 flex-col border-r border-border bg-card px-3 py-4 lg:flex">
      <div className="mb-5 flex items-center justify-between px-1.5">
        <Link href="/dashboard" className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="h-6 w-6" />
          <span className="text-[15px] font-medium tracking-body">Agora</span>
        </Link>
        <div className="flex items-center">
          <ThemeToggle />
          <NotificationBell align="left" />
        </div>
      </div>

      {/* Who you are signed in as, and which side of the market that puts you
          on. The address alone answered neither, and the dashboard changes
          shape depending on the side, so it is worth saying out loud. */}
      {user && (
        <Link
          href="/dashboard/profile"
          className="mb-4 flex items-center gap-2.5 rounded-lg bg-surface px-2.5 py-2.5 transition-colors hover:bg-elevate"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-[13px] font-medium text-accent-foreground">
            {initial}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-medium text-foreground">{name}</span>
            <span className="block text-[11.5px] text-subtle-foreground">{roleLabel(role)}</span>
          </span>
        </Link>
      )}

      <Link href={primary.href} className="mb-5">
        <span className="flex h-9 items-center justify-center gap-1.5 rounded-lg bg-accent text-[13.5px] font-medium text-accent-foreground shadow-raised transition hover:brightness-110">
          <PrimaryIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
          {primary.label}
        </span>
      </Link>

      <p className="mb-1.5 px-2 text-[11px] font-medium uppercase tracking-[0.08em] text-subtle-foreground">
        Menu
      </p>

      <div className="space-y-0.5">
        {nav.map((item) => {
          const active =
            item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(item.href)
          return (
            <Link key={item.href} href={item.href}>
              <span
                className={cn(
                  'relative flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[14px] transition-colors',
                  active
                    ? 'bg-accent-wash font-medium text-foreground'
                    : 'text-muted-foreground hover:bg-elevate hover:text-secondary-foreground',
                )}
              >
                {/* The marker is what makes the current tab findable at a
                    glance in a list of seven, without a fill loud enough to
                    compete with the primary button above it. */}
                {active && (
                  <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-accent" />
                )}
                <item.icon
                  className={cn('h-4 w-4 shrink-0', active && 'text-accent')}
                  strokeWidth={active ? 2.3 : 2}
                />
                {item.label}
                {(unread[item.href] ?? 0) > 0 && (
                  <>
                    <UnreadDot className="ml-auto mr-0.5" />
                    <span className="sr-only">{unread[item.href]} new</span>
                  </>
                )}
              </span>
            </Link>
          )
        })}
      </div>

      <button
        onClick={disconnect}
        className="mt-auto flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[14px] text-muted-foreground transition-colors hover:bg-elevate hover:text-destructive"
      >
        <LogOut className="h-4 w-4" />
        Disconnect
      </button>
    </nav>
  )
}
