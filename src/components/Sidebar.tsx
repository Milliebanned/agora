'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { useSession } from '@/components/SessionProvider'
import { navForRole, primaryActionForRole } from '@/lib/roles'
import { cn } from '@/lib/utils'

// A count next to the tab it belongs to. Capped at 9+ because the exact
// number stops mattering well before then — what matters is that something
// is waiting.
function NavBadge({ count }: { count: number }) {
  if (!count) return null
  return (
    <span className="ml-auto flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#3bb143] px-1 text-[11px] font-medium tabular-nums text-white">
      {count > 9 ? '9+' : count}
    </span>
  )
}

export default function Sidebar() {
  const pathname = usePathname()
  const { role, unread, markTabRead } = useSession()
  const router = useRouter()

  const nav = navForRole(role)
  const primary = primaryActionForRole(role)
  const PrimaryIcon = primary.icon

  // Being on a tab means having seen what was waiting under it.
  useEffect(() => {
    const match = nav.find((item) => item.href !== '/dashboard' && pathname.startsWith(item.href))
    if (match && unread[match.href]) markTabRead(match.href)
  }, [pathname, nav, unread, markTabRead])

  const disconnect = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {})
    router.push('/')
  }

  return (
    <nav className="sticky top-0 hidden h-screen w-[220px] shrink-0 flex-col border-r border-border bg-background px-3 py-4 lg:flex">
      <Link href="/dashboard" className="mb-6 flex items-center gap-2 px-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" className="h-6 w-6" />
        <span className="text-[15px] font-medium tracking-body">Agora</span>
      </Link>

      <Link href={primary.href} className="mb-4">
        <span className="flex h-8 items-center justify-center gap-1.5 rounded-md bg-[#3bb143] text-[13px] font-medium text-white transition hover:brightness-110">
          <PrimaryIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
          {primary.label}
        </span>
      </Link>

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
                  'flex h-8 items-center gap-2.5 rounded-md px-2 text-[14px] transition-colors',
                  active
                    ? 'bg-white/[0.06] text-foreground'
                    : 'text-muted-foreground hover:bg-white/[0.03] hover:text-secondary-foreground',
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
                <NavBadge count={unread[item.href] ?? 0} />
              </span>
            </Link>
          )
        })}
      </div>

      <button
        onClick={disconnect}
        className="mt-auto flex h-8 items-center gap-2.5 rounded-md px-2 text-[14px] text-muted-foreground transition-colors hover:bg-white/[0.03] hover:text-destructive"
      >
        <LogOut className="h-4 w-4" />
        Disconnect
      </button>
    </nav>
  )
}
