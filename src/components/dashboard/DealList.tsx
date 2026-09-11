'use client'

import Link from 'next/link'
import { StatusBadge, type BadgeProps } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export interface DealRow {
  id: string
  href: string
  title: string
  status: string
  statusTone?: BadgeProps['tone']
  amountNIM: number
  /** The one line that says why this row wants attention. */
  note?: string
}

// The row shape shared by both home screens and the applications list, so a
// deal reads the same wherever it turns up.
export default function DealList({ rows }: { rows: DealRow[] }) {
  return (
    <div className="overflow-hidden rounded-lg shadow-hairline">
      {rows.map((row, i) => (
        <Link key={row.id} href={row.href}>
          <div
            className={cn(
              'flex items-center justify-between gap-4 bg-card px-4 py-3.5 transition-colors hover:bg-surface',
              i > 0 && 'border-t border-border',
            )}
          >
            <div className="flex min-w-0 items-center gap-3">
              <StatusBadge status={row.status} tone={row.statusTone} />
              <div className="min-w-0">
                <p className="truncate text-[14px] text-secondary-foreground">{row.title}</p>
                {row.note && (
                  <p className="mt-0.5 truncate text-[12px] text-subtle-foreground">{row.note}</p>
                )}
              </div>
            </div>
            <span className="shrink-0 font-mono text-[13px] tabular-nums text-muted-foreground">
              {row.amountNIM.toFixed(2)} NIM
            </span>
          </div>
        </Link>
      ))}
    </div>
  )
}
