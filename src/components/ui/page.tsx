import * as React from 'react'
import { cn } from '@/lib/utils'
import { Card } from './card'

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <h1 className="text-[26px] font-medium leading-tight tracking-heading text-foreground sm:text-[30px]">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground sm:text-[15px]">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  )
}

export function StatTile({
  label,
  value,
  hint,
  accent,
  hero,
  icon: Icon,
  meter,
}: {
  label: string
  value: React.ReactNode
  hint?: string
  /** Worth noticing: the figure takes the brand colour. */
  accent?: boolean
  /** The one figure on the screen that is the point of it. Filled, not tinted,
   *  and never more than one per view or it stops meaning anything. */
  hero?: boolean
  icon?: React.ComponentType<{ className?: string }>
  /** 0 to 1. Draws the figure as a share of something rather than a number on
   *  its own, for the cases where the ceiling is the point. */
  meter?: number
}) {
  if (hero) {
    return (
      <div className="relative overflow-hidden rounded-lg bg-accent p-5 text-accent-foreground shadow-raised">
        {/* A soft bloom in the corner, the same one the landing page uses
            behind the globe, so the filled tile reads as part of this product
            rather than a coloured rectangle. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full opacity-40 blur-2xl"
          style={{ background: '#98fb98' }}
        />
        <div className="relative flex items-start justify-between gap-3">
          <p className="text-[13px] text-accent-foreground/75">{label}</p>
          {Icon && (
            <span className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent-foreground/15 sm:flex">
              <Icon className="h-4 w-4 text-accent-foreground" />
            </span>
          )}
        </div>
        <p className="relative mt-2 text-[30px] font-medium leading-none tracking-heading tabular-nums">
          {value}
        </p>
        {hint && <p className="relative mt-2 text-[12px] text-accent-foreground/70">{hint}</p>}
      </div>
    )
  }

  return (
    <Card className="transition-colors hover:border-border-strong">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[13px] text-muted-foreground">{label}</p>
          {Icon && (
            <span className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent-wash sm:flex">
              <Icon className="h-4 w-4 text-accent" />
            </span>
          )}
        </div>
        <p
          className={cn(
            'mt-2 text-[30px] font-medium leading-none tracking-heading tabular-nums',
            accent ? 'text-accent' : 'text-foreground',
          )}
        >
          {value}
        </p>
        {typeof meter === 'number' && (
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-elevate-strong">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-500"
              style={{ width: `${Math.max(0, Math.min(1, meter)) * 100}%` }}
            />
          </div>
        )}
        {hint && <p className="mt-2 text-[12px] leading-snug text-subtle-foreground">{hint}</p>}
      </div>
    </Card>
  )
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: React.ComponentType<{ className?: string }>
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <Card>
      <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
        {Icon && (
          <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-lg bg-accent-wash">
            <Icon className="h-5 w-5 text-accent" />
          </div>
        )}
        <p className="text-[15px] font-medium text-foreground">{title}</p>
        {description && (
          <p className="max-w-sm text-[14px] leading-relaxed text-muted-foreground">{description}</p>
        )}
        {action && <div className="mt-3">{action}</div>}
      </div>
    </Card>
  )
}

export function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'h-4 w-4 animate-spin rounded-full border-2 border-border border-t-muted-foreground',
        className,
      )}
    />
  )
}

export function PageLoading({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center gap-3 text-muted-foreground">
      <Spinner />
      <span className="text-[14px]">{label}…</span>
    </div>
  )
}
