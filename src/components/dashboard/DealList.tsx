'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
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
//
// One object, not a stack of cards: the rows share an outer edge and a single
// hairline between them, so a list of four reads as one list rather than four
// things that happen to be near each other.
export default function DealList({ rows }: { rows: DealRow[] }) {
  return (
    <div className="overflow-hidden rounded-lg bg-card shadow-card">
      {rows.map((row, i) => (
        <Link key={row.id} href={row.href} className="group block">
          <div
            className={cn(
              'flex items-center justify-between gap-4 px-4 py-4 transition-colors hover:bg-surface',
              i > 0 && 'border-t border-border',
            )}
          >
            <div className="flex min-w-0 items-center gap-3">
              <StatusBadge status={row.status} tone={row.statusTone} />
              <div className="min-w-0">
                <p className="truncate text-[14px] font-medium text-foreground">{row.title}</p>
                {row.note && (
                  <p className="mt-0.5 truncate text-[12.5px] text-muted-foreground">{row.note}</p>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <span className="font-mono text-[13px] tabular-nums text-secondary-foreground">
                {row.amountNIM.toFixed(2)} NIM
              </span>
              {/* Only on hover: seven of these pointing at nothing is noise. */}
              <ChevronRight className="h-4 w-4 text-subtle-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}
