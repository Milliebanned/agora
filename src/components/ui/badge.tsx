import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-sm px-1.5 py-0.5 text-[12px] font-normal leading-none',
  {
    variants: {
      tone: {
        neutral: 'bg-white/[0.05] text-muted-foreground',
        info: 'bg-info/10 text-info',
        success: 'bg-success/10 text-success',
        danger: 'bg-destructive/10 text-destructive',
        accent: 'bg-accent/10 text-accent',
        violet: 'bg-violet/10 text-violet',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone, className }))} {...props} />
}

const STATUS_TONES: Record<string, BadgeProps['tone']> = {
  draft: 'neutral',
  pending: 'neutral',
  active: 'info',
  funded: 'info',
  submitted: 'violet',
  completed: 'success',
  approved: 'success',
  released: 'success',
  resolved: 'success',
  disputed: 'danger',
  open: 'danger',
  cancelled: 'neutral',
  refunded: 'neutral',
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge tone={STATUS_TONES[status] ?? 'neutral'} className={className}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  )
}
