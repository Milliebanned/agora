'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/dashboard', label: '🏠 Home', icon: 'home' },
  { href: '/dashboard/agreements', label: '📋 Agreements', icon: 'agreements' },
  { href: '/dashboard/disputes', label: '⚖️ Disputes', icon: 'disputes' },
  { href: '/dashboard/profile', label: '👤 Profile', icon: 'profile' },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <nav className="bg-card border-r border-border w-64 min-h-screen p-6 sticky top-0">
      <h1 className="text-2xl font-bold mb-8 text-accent">NimTrust</h1>

      <div className="space-y-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={`px-4 py-3 rounded-lg font-semibold cursor-pointer transition-colors ${
                  isActive
                    ? 'bg-accent text-accent-foreground'
                    : 'text-foreground hover:bg-muted'
                }`}
              >
                {item.label}
              </div>
            </Link>
          )
        })}
      </div>

      <div className="mt-8 pt-8 border-t border-border">
        <button className="w-full px-4 py-2 bg-destructive text-destructive-foreground rounded-lg font-semibold hover:opacity-90 text-sm">
          Disconnect Wallet
        </button>
      </div>
    </nav>
  )
}
