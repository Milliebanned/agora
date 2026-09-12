'use client'

import { Card } from '@/components/ui/card'

export interface MoneySegment {
  label: string
  value: number
  /** What this figure means, in the reader's terms rather than the ledger's. */
  hint: string
  /** A CSS colour. Kept to the brand's own greens and one neutral, so the bar
   *  never introduces a hue the rest of the dashboard does not use. */
  color: string
}

// Where the money is, as a proportion rather than a column of figures.
//
// Four separate tiles could each be read, but not compared: "782 paid" and
// "1629 returned" only mean something next to each other. The bar is the
// comparison, the legend is the detail, and both come from the same ledger the
// tiles above use. Nothing here is estimated or smoothed.
export default function MoneyBreakdown({
  title,
  total,
  segments,
}: {
  title: string
  total: number
  segments: MoneySegment[]
}) {
  const shown = segments.filter((s) => s.value > 0)
  if (shown.length === 0) return null

  const sum = shown.reduce((acc, s) => acc + s.value, 0)

  return (
    <Card className="mt-3">
      <div className="p-5">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
          <p className="text-[13px] text-muted-foreground">{title}</p>
          <p className="font-mono text-[13px] tabular-nums text-secondary-foreground">
            {total.toFixed(2)} NIM
          </p>
        </div>

        <div className="mt-3 flex h-2.5 gap-0.5 overflow-hidden rounded-full">
          {shown.map((s) => (
            <div
              key={s.label}
              className="h-full first:rounded-l-full last:rounded-r-full"
              style={{ width: `${(s.value / sum) * 100}%`, background: s.color }}
              title={`${s.label}: ${s.value.toFixed(2)} NIM`}
            />
          ))}
        </div>

        {/* Flex rather than a fixed grid: a breakdown can have two segments or
            three, and a three-column track leaves a hole when it has two. */}
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-4">
          {shown.map((s) => (
            <div key={s.label} className="min-w-0 flex-1 basis-[150px]">
              <div className="flex items-center gap-2">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: s.color }}
                  aria-hidden="true"
                />
                <span className="truncate text-[12.5px] text-muted-foreground">{s.label}</span>
              </div>
              <p className="mt-1 font-mono text-[16px] font-medium tabular-nums text-foreground">
                {s.value.toFixed(2)}
              </p>
              <p className="mt-0.5 text-[11.5px] leading-snug text-subtle-foreground">{s.hint}</p>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}
