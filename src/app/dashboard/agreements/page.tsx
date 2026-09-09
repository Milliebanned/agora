'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { FileText, Plus, Compass } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/badge'
import { PageHeader, EmptyState, PageLoading } from '@/components/ui/page'
import { categoryLabel } from '@/lib/opportunities'
import { cn } from '@/lib/utils'

// Every deal this wallet is a party to, on either side. The public board lives
// at /dashboard/opportunities; this is the private ledger.
interface Deal {
  id: string
  title: string
  status: string
  category: string | null
  serviceType: string | null
  amountNIM: string | number
  budgetNIM: string | number | null
  deadline: string
  buyerId: string
  sellerId: string | null
  buyer?: { displayName: string | null }
  seller?: { displayName: string | null }
}

const FILTERS = ['all', 'draft', 'open', 'locked', 'submitted', 'completed', 'disputed']

export default function DealsPage() {
  const router = useRouter()
  const [deals, setDeals] = useState<Deal[]>([])
  const [me, setMe] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    fetch('/api/auth/session', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setMe(data?.user?.id ?? null))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const res = await fetch(
          filter === 'all' ? '/api/agreements' : `/api/agreements?status=${filter}`,
          { credentials: 'include' },
        )
        if (!res.ok) {
          router.push('/')
          return
        }
        setDeals(await res.json())
      } catch (err) {
        console.error('Failed to load deals:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [filter, router])

  return (
    <>
      <PageHeader
        title="Deals"
        description="Opportunities you posted and work you were selected for, from draft to settled."
        action={
          <Link href="/dashboard/opportunities/new">
            <Button>
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              Post opportunity
            </Button>
          </Link>
        }
      />

      <div className="-mx-4 mb-5 flex gap-1.5 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:px-0">
        {FILTERS.map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={cn(
              'h-7 shrink-0 rounded-full px-3 text-[13px] transition-colors',
              filter === status
                ? 'bg-white/[0.10] text-foreground'
                : 'bg-white/[0.04] text-muted-foreground hover:bg-white/[0.07] hover:text-secondary-foreground',
            )}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <PageLoading />
      ) : deals.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={filter === 'all' ? 'No deals yet' : `Nothing ${filter}`}
          description="Post work with the budget committed up front, or find an opportunity that already has its escrow funded."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Link href="/dashboard/opportunities/new">
                <Button>
                  <Plus className="h-4 w-4" strokeWidth={2.5} />
                  Post opportunity
                </Button>
              </Link>
              <Link href="/dashboard/opportunities">
                <Button variant="secondary">
                  <Compass className="h-4 w-4" />
                  Browse the board
                </Button>
              </Link>
            </div>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg shadow-hairline">
          {deals.map((deal, i) => {
            const asClient = deal.buyerId === me
            const counterparty = asClient
              ? deal.seller?.displayName ?? 'No freelancer yet'
              : deal.buyer?.displayName ?? 'the client'
            return (
              <Link key={deal.id} href={`/dashboard/opportunities/${deal.id}`}>
                <div
                  className={cn(
                    'bg-card px-4 py-4 transition-colors hover:bg-surface',
                    i > 0 && 'border-t border-border',
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge
                          status={deal.status}
                          tone={deal.status === 'open' ? 'accent' : undefined}
                        />
                        <span className="truncate text-[15px] font-medium tracking-body">
                          {deal.title}
                        </span>
                      </div>
                      <p className="mt-1.5 text-[13px] text-muted-foreground">
                        {asClient ? 'You posted this' : 'You are delivering'} · {counterparty}
                      </p>
                      <p className="mt-1 text-[12px] text-subtle-foreground">
                        {categoryLabel(deal.category)}
                        {deal.serviceType ? ` · ${deal.serviceType}` : ''}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-mono text-[14px] tabular-nums text-foreground">
                        {Number(deal.amountNIM).toFixed(2)} NIM
                      </p>
                      <p className="mt-1 text-[12px] text-subtle-foreground">
                        due {new Date(deal.deadline).toLocaleDateString()}
                      </p>
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
