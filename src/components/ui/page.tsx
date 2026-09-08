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
    <div className="flex items-start justify-between gap-6 mb-8">
      <div>
        <h1 className="text-heading-sm font-medium text-foreground">{title}</h1>
        {description && <p className="mt-1.5 text-[15px] text-muted-foreground">{description}</p>}
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
}: {
  label: string
  value: React.ReactNode
  hint?: string
  accent?: boolean
}) {
  return (
    <Card>
      <div className="p-5">
        <p className="text-[13px] text-muted-foreground">{label}</p>
        <p
          className={cn(
            'mt-2 text-[28px] font-medium tracking-heading tabular-nums',
            accent ? 'text-accent' : 'text-foreground',
          )}
        >
          {value}
        </p>
        {hint && <p className="mt-1 text-[12px] text-subtle-foreground">{hint}</p>}
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
      <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
        {Icon && (
          <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-lg bg-white/[0.04]">
            <Icon className="h-5 w-5 text-muted-foreground" />
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
        'h-4 w-4 animate-spin rounded-full border-2 border-white/15 border-t-white/70',
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
