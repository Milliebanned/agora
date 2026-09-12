'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell } from 'lucide-react'
import { useSession } from '@/components/SessionProvider'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'

// Somewhere to actually read what happened.
//
// A count on a tab says something arrived and then takes it away again the
// moment you go looking, which is indistinguishable from nothing having
// arrived at all. Notifications now stay unread until they are opened here,
// and this is the one place that marks them read, because opening the list is
// the only moment we can honestly say somebody saw them.
export default function NotificationBell({
  className,
  align = 'right',
}: {
  className?: string
  /** Which edge the panel hangs from. The sidebar is narrower than the panel,
   *  so its one opens rightward over the page instead of off the screen. */
  align?: 'left' | 'right'
}) {
  const router = useRouter()
  const { unread, recent, markAllRead, refreshNotifications } = useSession()
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)

  const waiting = Object.values(unread).reduce((sum, n) => sum + n, 0)

  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  const toggle = async () => {
    const next = !open
    setOpen(next)
    if (next) {
      await refreshNotifications()
      // Read on open, not on arriving at some page that happens to match.
      if (waiting > 0) await markAllRead()
    }
  }

  return (
    <div ref={wrap} className={cn('relative', className)}>
      <button
        type="button"
        onClick={toggle}
        aria-label={waiting > 0 ? `${waiting} unread notifications` : 'Notifications'}
        aria-expanded={open}
        className="relative flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-white/[0.04] hover:text-foreground"
      >
        <Bell className="h-4 w-4" />
        {waiting > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#3bb143] px-1 text-[10px] font-medium tabular-nums text-white">
            {waiting > 9 ? '9+' : waiting}
          </span>
        )}
      </button>

      {open && (
        <div className={cn(
            'absolute z-50 mt-2 w-[min(340px,calc(100vw-32px))] overflow-hidden rounded-lg border border-border bg-card shadow-float',
            align === 'left' ? 'left-0' : 'right-0',
          )}>
          <div className="border-b border-border px-4 py-2.5">
            <span className="text-[13px] font-medium tracking-body">Notifications</span>
          </div>

          {recent.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-muted-foreground">
              Nothing yet. Proposals, messages and decisions on your deals show up here.
            </p>
          ) : (
            <div className="max-h-[340px] overflow-y-auto">
              {recent.map((n, i) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    if (n.href) router.push(n.href)
                  }}
                  className={cn(
                    'flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-surface',
                    i > 0 && 'border-t border-border',
                  )}
                >
                  <span className="text-[13px] leading-snug text-secondary-foreground">
                    {n.body}
                  </span>
                  <span className="text-[11.5px] text-subtle-foreground">
                    {formatDate(n.createdAt)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
