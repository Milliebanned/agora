'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { FileText, Plus, Compass } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/badge'
import { PageHeader, EmptyState, PageLoading } from '@/components/ui/page'
import { useSession } from '@/components/SessionProvider'
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

const FILTERS = ['all', 'draft', 'open', 'locked', 'submitted', 'completed', 'disputed', 'settled']

// A deal is past only once nothing can happen on it again. `completed` stays
// current on purpose: the work is approved but the escrow still has to be
// claimed, so it is the one status where money is left on the table.
const CLOSED_STATUSES = new Set(['settled', 'refunded', 'cancelled'])

export default function DealsPage() {
  const router = useRouter()
  const { user, role } = useSession()
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  const me = user?.id ?? null
  const isFreelancer = role === 'provider'

  const findWorkButton = (
    <Link href="/dashboard/opportunities">
      <Button>
        <Compass className="h-4 w-4" />
        Find work
      </Button>
    </Link>
  )

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
          isFreelancer ? (
            findWorkButton
          ) : (
            <Link href="/dashboard/opportunities/new">
              <Button>
                <Plus className="h-4 w-4" strokeWidth={2.5} />
                Post opportunity
              </Button>
            </Link>
          )
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
          description={
            isFreelancer
              ? 'Every posting on the board has its budget committed to escrow already, so the money is there before you write a proposal.'
              : 'Post work with the budget committed up front, or find an opportunity that already has its escrow funded.'
          }
          action={
            isFreelancer ? (
              findWorkButton
            ) : (
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
            )
          }
        />
      ) : (
        <DealSections deals={deals} me={me} isFreelancer={isFreelancer} />
      )}
    </>
  )
}

// Current and past kept apart, so "what am I on the hook for" never has to be
// read out of a single undifferentiated list.
function DealSections({
  deals,
  me,
  isFreelancer,
}: {
  deals: Deal[]
  me: string | null
  isFreelancer: boolean
}) {
  const current = deals.filter((d) => !CLOSED_STATUSES.has(d.status))
  const past = deals.filter((d) => CLOSED_STATUSES.has(d.status))

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-[15px] font-medium tracking-body">Current</h2>
          <span className="text-[13px] text-subtle-foreground">
            {current.length} {current.length === 1 ? 'deal' : 'deals'}
          </span>
        </div>
        {current.length === 0 ? (
          <div className="rounded-lg bg-card px-4 py-8 text-center shadow-hairline">
            <p className="text-[14px] text-muted-foreground">
              {isFreelancer
                ? 'No work in flight right now.'
                : 'Nothing under way right now.'}
            </p>
          </div>
        ) : (
          <DealRows deals={current} me={me} />
        )}
      </section>

      {past.length > 0 && (
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-[15px] font-medium tracking-body">Past</h2>
            <span className="text-[13px] text-subtle-foreground">
              {past.length} {past.length === 1 ? 'deal' : 'deals'}
            </span>
          </div>
          <DealRows deals={past} me={me} />
        </section>
      )}
    </div>
  )
}

function DealRows({ deals, me }: { deals: Deal[]; me: string | null }) {
  return (
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
  )
}
