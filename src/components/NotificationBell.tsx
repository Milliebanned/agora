'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell } from 'lucide-react'
import { useSession } from '@/components/SessionProvider'
import UnreadDot from '@/components/ui/unread-dot'
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
        className="relative flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-elevate hover:text-foreground"
      >
        <Bell className="h-4 w-4" />
        {waiting > 0 && <UnreadDot className="absolute right-1 top-1" />}
      </button>

      {open && (
        <div
          className={cn(
            'overflow-hidden rounded-lg border border-border bg-card shadow-float',
            // On a phone the bell sits in the middle of the top bar, with the
            // primary action and the disconnect button to its right. A panel
            // hung off that button's own edge is wider than the space left of
            // it, so it ran off the side of the screen. Here it spans the page
            // under the bar instead. The top bar is the containing block for
            // this (it carries a backdrop filter), but its padding box is the
            // full width at the top of the screen, so these insets land in the
            // same place either way.
            'fixed inset-x-3 top-[60px] z-50',
            // From the sidebar up there is room to hang it off the button.
            'lg:absolute lg:inset-x-auto lg:top-auto lg:mt-2 lg:w-[340px]',
            align === 'left' ? 'lg:left-0' : 'lg:right-0',
          )}
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <span className="text-[13px] font-medium tracking-body">Notifications</span>
            {waiting > 0 && (
              <span className="text-[12px] text-[#eb5757]">{waiting} new</span>
            )}
          </div>

          {recent.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-muted-foreground">
              Nothing yet. Proposals, messages and decisions on your deals show up here.
            </p>
          ) : (
            <div className="max-h-[min(60vh,340px)] overflow-y-auto overscroll-contain">
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
                  <span
                    className={cn(
                      'flex items-start gap-2 text-[13px] leading-snug',
                      n.read ? 'text-muted-foreground' : 'text-secondary-foreground',
                    )}
                  >
                    {/* The dot is the only thing separating what is new from
                        what was already here the last time they looked. */}
                    {!n.read && <UnreadDot className="mt-[5px] shrink-0 ring-card" />}
                    {n.body}
                  </span>
                  <span
                    className={cn(
                      'text-[11.5px] text-subtle-foreground',
                      !n.read && 'pl-[18px]',
                    )}
                  >
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
