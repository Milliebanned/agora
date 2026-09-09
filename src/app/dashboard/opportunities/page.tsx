'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Compass, Plus, Lock, Users, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader, EmptyState, PageLoading } from '@/components/ui/page'
import FilterBar, { DEFAULT_FILTERS, toQuery, type BoardFilters } from '@/components/opportunity/FilterBar'
import { categoryLabel } from '@/lib/opportunities'
import { cn } from '@/lib/utils'

interface BoardRow {
  id: string
  title: string
  description: string
  category: string | null
  serviceType: string | null
  amountNIM: string | number
  budgetNIM: string | number | null
  timelineDays: number | null
  publishedAt: string | null
  buyerId: string
  buyer?: { id: string; displayName: string | null }
  _count?: { proposals: number }
}

function timeAgo(iso: string | null): string {
  if (!iso) return ''
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

export default function OpportunitiesPage() {
  const router = useRouter()
  const [rows, setRows] = useState<BoardRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<BoardFilters>(DEFAULT_FILTERS)
  const [me, setMe] = useState<string | null>(null)

  const load = useCallback(async (next: BoardFilters) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/opportunities${toQuery(next)}`, { credentials: 'include' })
      if (!res.ok) {
        router.push('/')
        return
      }
      setRows(await res.json())
    } catch (err) {
      console.error('Failed to load opportunities:', err)
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    fetch('/api/auth/session', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setMe(data?.user?.id ?? null))
      .catch(() => {})
  }, [])

  useEffect(() => {
    load(filters)
  }, [filters, load])

  return (
    <>
      <PageHeader
        title="Opportunities"
        description="Every posting here has its budget already committed to escrow before a single proposal is written."
        action={
          <Link href="/dashboard/opportunities/new">
            <Button>
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              Post opportunity
            </Button>
          </Link>
        }
      />

      <FilterBar filters={filters} onChange={setFilters} />

      {loading ? (
        <PageLoading label="Loading the board" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Compass}
          title="Nothing matches those filters"
          description="Widen the budget or timeline, or post the work you need doing yourself."
          action={
            <Link href="/dashboard/opportunities/new">
              <Button>
                <Plus className="h-4 w-4" strokeWidth={2.5} />
                Post an opportunity
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg shadow-hairline">
          {rows.map((row, i) => {
            const budget = Number(row.budgetNIM ?? row.amountNIM)
            const mine = row.buyerId === me
            return (
              <Link key={row.id} href={`/dashboard/opportunities/${row.id}`}>
                <div
                  className={cn(
                    'bg-card px-4 py-4 transition-colors hover:bg-surface',
                    i > 0 && 'border-t border-border',
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="accent">
                          <Lock className="h-3 w-3" />
                          Funded
                        </Badge>
                        {mine && <Badge tone="violet">Your posting</Badge>}
                        <span className="text-[12px] text-subtle-foreground">
                          {timeAgo(row.publishedAt)}
                        </span>
                      </div>
                      <p className="mt-2 truncate text-[15px] font-medium tracking-body">
                        {row.title}
                      </p>
                      <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
                        {row.description}
                      </p>
                      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-subtle-foreground">
                        <span>
                          {categoryLabel(row.category)}
                          {row.serviceType ? ` · ${row.serviceType}` : ''}
                        </span>
                        {row.timelineDays && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {row.timelineDays}d
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {row._count?.proposals ?? 0} proposal
                          {(row._count?.proposals ?? 0) === 1 ? '' : 's'}
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-mono text-[15px] tabular-nums text-foreground">
                        {budget.toFixed(0)}
                      </p>
                      <p className="mt-0.5 text-[11px] text-subtle-foreground">NIM budget</p>
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </>
  )
}
