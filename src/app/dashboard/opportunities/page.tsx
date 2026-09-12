'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Compass, Plus, Lock, Users, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { PageHeader, EmptyState, PageLoading } from '@/components/ui/page'
import FilterBar, {
  DEFAULT_FILTERS,
  toQuery,
  type BoardFilters,
  type BoardScope,
} from '@/components/opportunity/FilterBar'
import { useSession } from '@/components/SessionProvider'
import { categoryLabel } from '@/lib/opportunities'
import { roleCopy } from '@/lib/roles'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/lib/types'

interface BoardRow {
  id: string
  title: string
  description: string
  category: string | null
  serviceType: string | null
  status: string
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

// A client lands on their own postings, a freelancer on the open board. Both
// can reach the other view; this only decides which one opens first.
function defaultScopeFor(role: UserRole | null): BoardScope {
  return role === 'client' ? 'mine' : 'board'
}

const SCOPE_TABS: { id: BoardScope; label: string }[] = [
  { id: 'mine', label: 'My postings' },
  { id: 'board', label: 'Public board' },
]

export default function OpportunitiesPage() {
  const router = useRouter()
  const { user, role, loading: sessionLoading } = useSession()
  const [rows, setRows] = useState<BoardRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<BoardFilters>(DEFAULT_FILTERS)

  const copy = roleCopy(role)
  const isClient = role === 'client'
  const viewingOwn = filters.scope === 'mine'

  // This board is where freelancers find work. A client's equivalent is Find
  // workers, and their own postings live under Deals, so send them there.
  useEffect(() => {
    if (sessionLoading) return
    if (role === 'client') router.replace('/dashboard/workers')
  }, [role, sessionLoading, router])

  // Role decides the opening view, and a switch of sides resets it rather than
  // leaving the other role's scope behind.
  useEffect(() => {
    if (sessionLoading) return
    setFilters((prev) => ({ ...prev, scope: defaultScopeFor(role) }))
  }, [role, sessionLoading])

  const load = useCallback(
    async (next: BoardFilters) => {
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
    },
    [router],
  )

  useEffect(() => {
    if (sessionLoading) return
    load(filters)
  }, [filters, load, sessionLoading])

  const title = viewingOwn ? 'My postings' : isClient ? 'Public board' : copy.boardTitle
  const description = viewingOwn
    ? 'The work you have put up, and the proposals waiting on each one.'
    : role === 'provider'
      ? copy.boardDescription
      : 'Every posting here has its budget already committed to escrow before a single proposal is written.'

  return (
    <>
      <PageHeader
        title={title}
        description={description}
        action={
          isClient ? (
            <Link href="/dashboard/opportunities/new">
              <Button>
                <Plus className="h-4 w-4" strokeWidth={2.5} />
                Post job
              </Button>
            </Link>
          ) : undefined
        }
      />

      {/* Only a client has two sides to flip between: their own postings and
          the public board. A freelancer only ever sees the board. */}
      {isClient && (
        <div className="mb-5 flex gap-1.5">
          {SCOPE_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilters({ ...filters, scope: tab.id })}
              className={cn(
                'h-8 rounded-md px-3 text-[13px] transition-colors',
                filters.scope === tab.id
                  ? 'bg-white/[0.10] text-foreground'
                  : 'bg-white/[0.04] text-muted-foreground hover:bg-white/[0.07] hover:text-secondary-foreground',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      <FilterBar filters={filters} onChange={setFilters} />

      {loading || sessionLoading ? (
        <PageLoading label={viewingOwn ? 'Loading your postings' : 'Loading the board'} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Compass}
          title={viewingOwn ? copy.boardEmptyTitle : 'Nothing matches those filters'}
          description={
            viewingOwn
              ? copy.boardEmptyBody
              : role === 'provider'
                ? copy.boardEmptyBody
                : 'Widen the budget or timeline, or post the work you need doing yourself.'
          }
          action={
            isClient ? (
              <Link href="/dashboard/opportunities/new">
                <Button>
                  <Plus className="h-4 w-4" strokeWidth={2.5} />
                  Post a job
                </Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg shadow-hairline">
          {rows.map((row, i) => {
            const budget = Number(row.budgetNIM ?? row.amountNIM)
            const mine = row.buyerId === user?.id
            const proposals = row._count?.proposals ?? 0
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
                        {/* On your own list the status is the useful signal; on
                            the board it is always "open", so the funded badge
                            earns the space instead. */}
                        {viewingOwn ? (
                          <StatusBadge
                            status={row.status}
                            tone={row.status === 'open' ? 'accent' : undefined}
                          />
                        ) : (
                          <Badge tone="accent">
                            <Lock className="h-3 w-3" />
                            Funded
                          </Badge>
                        )}
                        {mine && !viewingOwn && <Badge tone="violet">Your posting</Badge>}
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
                        <span
                          className={cn(
                            'flex items-center gap-1',
                            viewingOwn && proposals > 0 && 'text-[#98fb98]',
                          )}
                        >
                          <Users className="h-3 w-3" />
                          {proposals} proposal
                          {proposals === 1 ? '' : 's'}
                          {viewingOwn && proposals > 0 ? ' waiting' : ''}
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
