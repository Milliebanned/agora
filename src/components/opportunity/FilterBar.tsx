'use client'

import { BUDGET_BANDS, CATEGORIES, SORTS, TIMELINE_BANDS } from '@/lib/opportunities'
import { Select } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export interface BoardFilters {
  category: string
  budget: string
  timeline: string
  sort: string
}

export const DEFAULT_FILTERS: BoardFilters = {
  category: 'all',
  budget: 'any',
  timeline: 'any',
  sort: 'newest',
}

export function toQuery(filters: BoardFilters): string {
  const params = new URLSearchParams()
  if (filters.category !== 'all') params.set('category', filters.category)
  if (filters.budget !== 'any') params.set('budget', filters.budget)
  if (filters.timeline !== 'any') params.set('timeline', filters.timeline)
  if (filters.sort !== 'newest') params.set('sort', filters.sort)
  const q = params.toString()
  return q ? `?${q}` : ''
}

export default function FilterBar({
  filters,
  onChange,
}: {
  filters: BoardFilters
  onChange: (next: BoardFilters) => void
}) {
  const set = (patch: Partial<BoardFilters>) => onChange({ ...filters, ...patch })

  return (
    <div className="mb-5 space-y-3">
      {/* Category is the filter people reach for first, so it stays one tap
          away rather than behind a dropdown. */}
      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:px-0">
        {[{ id: 'all', label: 'All work' }, ...CATEGORIES].map((c) => (
          <button
            key={c.id}
            onClick={() => set({ category: c.id })}
            className={cn(
              'h-7 shrink-0 rounded-full px-3 text-[13px] transition-colors',
              filters.category === c.id
                ? 'bg-white/[0.10] text-foreground'
                : 'bg-white/[0.04] text-muted-foreground hover:bg-white/[0.07] hover:text-secondary-foreground',
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Select
          aria-label="Budget"
          value={filters.budget}
          onChange={(e) => set({ budget: e.target.value })}
          className="py-2 text-[13px]"
        >
          {BUDGET_BANDS.map((b) => (
            <option key={b.id} value={b.id}>
              {b.label}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Timeline"
          value={filters.timeline}
          onChange={(e) => set({ timeline: e.target.value })}
          className="py-2 text-[13px]"
        >
          {TIMELINE_BANDS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Sort"
          value={filters.sort}
          onChange={(e) => set({ sort: e.target.value })}
          className="py-2 text-[13px]"
        >
          {SORTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </Select>
      </div>
    </div>
  )
}
