'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Users, Clock, Star, Megaphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Select } from '@/components/ui/input'
import { PageHeader, EmptyState, PageLoading } from '@/components/ui/page'
import WorkerCard from '@/components/dashboard/WorkerCard'
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
    avatarUpdatedAt: string | null
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
  // Arriving from a service card on the landing page, which names one.
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get('category')
    if (wanted && CATEGORIES.some((c) => c.id === wanted)) setCategory(wanted)
  }, [])
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
        {/* Wraps rather than scrolling sideways: a filter somebody has to
            swipe to find is a filter they do not know is there. */}
        <div className="flex flex-wrap gap-1.5">
          {[{ id: 'all', label: 'All work' }, ...CATEGORIES].map((c) => (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              className={cn(
                'h-7 rounded-full px-3 text-[13px] transition-colors',
                category === c.id
                  ? 'bg-elevate-strong text-foreground'
                  : 'bg-elevate text-muted-foreground hover:bg-elevate-strong hover:text-secondary-foreground',
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((listing) => (
            <WorkerCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}
    </>
  )
}
