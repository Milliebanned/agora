'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Users, Clock, Star, Megaphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Select } from '@/components/ui/input'
import { PageHeader, EmptyState, PageLoading } from '@/components/ui/page'
import { useSession } from '@/components/SessionProvider'
import { CATEGORIES, categoryLabel } from '@/lib/opportunities'
import { shortAddress, cn } from '@/lib/utils'

interface Listing {
  id: string
  title: string
  description: string
  category: string
  serviceType: string | null
  priceNIM: string | number
  deliveryDays: number
  provider: {
    id: string
    address: string
    displayName: string | null
    bio: string | null
    reputationScores: { trustScore: number; completedAgreements: number } | null
  }
}

const SORTS = [
  { id: 'newest', label: 'Newest' },
  { id: 'price_low', label: 'Price: low to high' },
  { id: 'price_high', label: 'Price: high to low' },
  { id: 'delivery_fast', label: 'Fastest delivery' },
]

// The client's board: freelancers advertising what they do. The mirror of the
// freelancer's Find work. Hiring from one opens the normal posting form with
// the advertisement's terms filled in, so the money still goes through escrow.
export default function WorkersPage() {
  const { loading: sessionLoading } = useSession()
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('all')
  const [sort, setSort] = useState('newest')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (category !== 'all') params.set('category', category)
      if (sort !== 'newest') params.set('sort', sort)
      const q = params.toString()
      const res = await fetch(`/api/services${q ? `?${q}` : ''}`, { credentials: 'include' })
      if (res.ok) setListings(await res.json())
    } catch (err) {
      console.error('Failed to load advertisements:', err)
    } finally {
      setLoading(false)
    }
  }, [category, sort])

  useEffect(() => {
    if (sessionLoading) return
    load()
  }, [load, sessionLoading])

  return (
    <>
      <PageHeader
        title="Find workers"
        description="Freelancers advertising what they do and what they charge. Hire one and the budget goes into escrow exactly as it does on a posting."
      />

      <div className="mb-5 space-y-3">
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:px-0">
          {[{ id: 'all', label: 'All work' }, ...CATEGORIES].map((c) => (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              className={cn(
                'h-7 shrink-0 rounded-full px-3 text-[13px] transition-colors',
                category === c.id
                  ? 'bg-white/[0.10] text-foreground'
                  : 'bg-white/[0.04] text-muted-foreground hover:bg-white/[0.07] hover:text-secondary-foreground',
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
        <Select
          aria-label="Sort"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="py-2 text-[13px] sm:max-w-[240px]"
        >
          {SORTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </Select>
      </div>

      {loading || sessionLoading ? (
        <PageLoading label="Loading freelancers" />
      ) : listings.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title={
            category === 'all'
              ? 'No advertisements yet'
              : `No one is advertising ${categoryLabel(category).toLowerCase()} work yet`
          }
          description="Freelancers post what they offer here. You can always describe the work yourself and let proposals come to you instead."
          action={
            <Link href="/dashboard/opportunities/new">
              <Button>Post a job</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {listings.map((listing) => {
            const rep = listing.provider.reputationScores
            const name = listing.provider.displayName ?? shortAddress(listing.provider.address)
            return (
              <Card key={listing.id}>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-subtle-foreground">
                        <span className="flex items-center gap-1.5 text-secondary-foreground">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/[0.06] text-[10px]">
                            {name.charAt(0).toUpperCase()}
                          </span>
                          {name}
                        </span>
                        {rep && (
                          <span className="flex items-center gap-1">
                            <Star className="h-3 w-3" />
                            {Math.round(rep.trustScore)} trust · {rep.completedAgreements} done
                          </span>
                        )}
                        <span>
                          {categoryLabel(listing.category)}
                          {listing.serviceType ? ` · ${listing.serviceType}` : ''}
                        </span>
                      </div>

                      <p className="mt-2.5 text-[15px] font-medium tracking-body">{listing.title}</p>
                      <p className="mt-1 line-clamp-3 text-[13px] leading-relaxed text-muted-foreground">
                        {listing.description}
                      </p>
                      <p className="mt-2 flex items-center gap-1 text-[12px] text-subtle-foreground">
                        <Clock className="h-3 w-3" />
                        Delivers in {listing.deliveryDays} day
                        {listing.deliveryDays === 1 ? '' : 's'}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="font-mono text-[16px] tabular-nums text-foreground">
                        {Number(listing.priceNIM).toFixed(0)}
                      </p>
                      <p className="mt-0.5 text-[11px] text-subtle-foreground">NIM</p>
                    </div>
                  </div>

                  <div className="mt-4 border-t border-border pt-4">
                    <Link href={`/dashboard/opportunities/new?from=${listing.id}`}>
                      <Button size="sm">
                        <Users className="h-3.5 w-3.5" />
                        Hire {name}
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </>
  )
}
