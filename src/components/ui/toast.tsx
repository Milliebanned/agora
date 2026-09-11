'use client'

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type ToastKind = 'success' | 'error' | 'info'

interface Toast {
  id: number
  kind: ToastKind
  message: string
}

interface ToastApi {
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

export function useToast(): ToastApi {
  const api = useContext(ToastContext)
  if (!api) throw new Error('useToast must be used inside <ToastProvider>')
  return api
}

const AUTO_DISMISS_MS = 5000
const MAX_VISIBLE = 3

const KIND_STYLES: Record<ToastKind, { icon: typeof CheckCircle2; className: string }> = {
  success: { icon: CheckCircle2, className: 'text-[#98fb98]' },
  error: { icon: AlertTriangle, className: 'text-destructive' },
  info: { icon: Info, className: 'text-muted-foreground' },
}

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const text = message?.trim()
      if (!text) return
      const id = nextId.current++
      setToasts((prev) => [...prev, { id, kind, message: text }].slice(-MAX_VISIBLE))
      // Errors stay until dismissed. A failed escrow payment is not something
      // to blink past, and it often carries recovery instructions.
      if (kind !== 'error') {
        setTimeout(() => dismiss(id), AUTO_DISMISS_MS)
      }
    },
    [dismiss],
  )

  const api = useMemo<ToastApi>(
    () => ({
      success: (m: string) => push('success', m),
      error: (m: string) => push('error', m),
      info: (m: string) => push('info', m),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* Bottom on mobile, clear of the fixed tab bar (h-14) and the home
          indicator; top-right on desktop where nothing else lives. */}
      <div
        className="toast-dock pointer-events-none fixed inset-x-4 z-[60] flex flex-col gap-2 lg:inset-x-auto lg:right-6 lg:top-6 lg:w-[380px]"
        role="status"
        aria-live="polite"
      >
        {toasts.map((toast) => {
          const { icon: Icon, className } = KIND_STYLES[toast.kind]
          return (
            <div
              key={toast.id}
              className="toast-enter pointer-events-auto flex items-start gap-2.5 rounded-lg border border-border bg-card p-3.5 shadow-float"
            >
              <Icon className={cn('mt-px h-4 w-4 shrink-0', className)} />
              <p className="flex-1 text-[13px] leading-relaxed text-secondary-foreground">
                {toast.message}
              </p>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label="Dismiss"
                className="-m-1 shrink-0 rounded p-1 text-subtle-foreground transition-colors hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
