'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Home, Compass, FileText, Scale, User, LogOut, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/dashboard/opportunities', label: 'Opportunities', icon: Compass },
  { href: '/dashboard/agreements', label: 'Deals', icon: FileText },
  { href: '/dashboard/disputes', label: 'Disputes', icon: Scale },
  { href: '/dashboard/profile', label: 'Profile', icon: User },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

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

      <Link href="/dashboard/opportunities/new" className="mb-4">
        <span className="flex h-8 items-center justify-center gap-1.5 rounded-md bg-accent text-[13px] font-medium text-accent-foreground transition hover:brightness-110">
          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
          Post opportunity
        </span>
      </Link>

      <div className="space-y-0.5">
        {NAV.map((item) => {
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
