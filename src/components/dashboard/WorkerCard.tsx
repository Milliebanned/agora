'use client'

import Link from 'next/link'
import { Clock, Star, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Avatar from '@/components/ui/avatar'
import { categoryLabel } from '@/lib/opportunities'
import { shortAddress } from '@/lib/utils'

export interface WorkerListing {
  id: string
  title: string
  description: string
  category: string | null
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

// A freelancer, advertised.
//
// The card leads with the person rather than the listing, because that is what
// is actually being chosen between: the picture is the first thing on it and
// the largest, centred, with the name directly under it. The listing wraps
// around that — what it costs in the top corner, what it is in the middle,
// and the one thing you can do about it across the bottom.
//
// Every figure on it is real. The standing at the top is derived from the
// reputation this person has actually earned, and a card says nothing at all
// rather than inventing a rank for somebody who has not finished a job yet.
function standing(rep: WorkerListing['provider']['reputationScores']) {
  const done = rep?.completedAgreements ?? 0
  const trust = rep?.trustScore ?? 50
  if (done >= 3 && trust >= 75) return { label: 'Top rated', tone: 'accent' as const }
  if (done === 0) return { label: 'New here', tone: 'muted' as const }
  return null
}

export default function WorkerCard({ listing }: { listing: WorkerListing }) {
  const { provider } = listing
  const rep = provider.reputationScores
  const name = provider.displayName ?? shortAddress(provider.address)
  const rank = standing(rep)

  // Delivery time is already in the row of figures above, so it is not
  // repeated here: two chips fit on one line, three wrap and make the card
  // taller than the one beside it for no new information.
  const chips = [categoryLabel(listing.category), listing.serviceType].filter(
    Boolean,
  ) as string[]

  return (
    <div className="flex flex-col rounded-lg bg-card p-5 shadow-card transition-shadow hover:shadow-raised">
      <div className="flex items-start justify-between gap-3">
        {rank ? (
          <span
            className={
              rank.tone === 'accent'
                ? 'rounded-full bg-accent-wash px-2.5 py-1 text-[11.5px] font-medium text-accent'
                : 'rounded-full bg-elevate px-2.5 py-1 text-[11.5px] text-muted-foreground'
            }
          >
            {rank.label}
          </span>
        ) : (
          <span />
        )}
        <span className="text-right">
          <span className="block font-mono text-[15px] font-medium tabular-nums text-foreground">
            {Number(listing.priceNIM).toFixed(0)} NIM
          </span>
          <span className="block text-[11px] text-subtle-foreground">fixed price</span>
        </span>
      </div>

      <div className="mt-3 flex flex-col items-center text-center">
        {/* The ring is what stops the picture sitting flat on the card, and it
            is drawn in the accent at a low opacity so it reads on both themes
            without becoming a second border. */}
        <Avatar person={provider} size={76} className="ring-4 ring-accent/15" />

        <p className="mt-3 text-[16px] font-medium tracking-body text-foreground">{name}</p>
        <p className="mt-0.5 text-[12.5px] text-muted-foreground">
          {categoryLabel(listing.category)}
          {listing.serviceType ? ` · ${listing.serviceType}` : ''}
        </p>

        <div className="mt-2.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[12px] text-subtle-foreground">
          <span className="flex items-center gap-1">
            <Star className="h-3 w-3 text-accent" />
            <span className="tabular-nums text-secondary-foreground">
              {Math.round(rep?.trustScore ?? 50)}
            </span>
            trust
          </span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">
            {rep?.completedAgreements ?? 0} completed
          </span>
          <span aria-hidden="true">·</span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {listing.deliveryDays}d
          </span>
        </div>
      </div>

      <p className="mt-4 text-[14px] font-medium leading-snug tracking-body text-foreground">
        {listing.title}
      </p>
      <p className="mt-1.5 line-clamp-3 text-[13px] leading-relaxed text-muted-foreground">
        {listing.description}
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {chips.map((chip) => (
          <span
            key={chip}
            className="rounded-full bg-elevate px-2.5 py-1 text-[11.5px] text-secondary-foreground"
          >
            {chip}
          </span>
        ))}
      </div>

      {/* mt-auto so the button sits on the same line across a row of cards
          whatever length the descriptions above it happen to be. */}
      <Link href={`/dashboard/opportunities/new?from=${listing.id}`} className="mt-auto block pt-5">
        <Button className="w-full" size="sm">
          <Users className="h-3.5 w-3.5" />
          Hire {name}
        </Button>
      </Link>
    </div>
  )
}
