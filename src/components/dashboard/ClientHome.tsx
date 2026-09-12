'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, ArrowUpRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { StatTile, EmptyState } from '@/components/ui/page'
import DealList, { type DealRow } from './DealList'
import type { DashboardDeal } from '@/app/dashboard/page'

interface PostingRow {
  id: string
  title: string
  status: string
  amountNIM: string | number
  _count?: { proposals: number }
}

// The client's first screen answers one question: who is waiting on me, and
// what is my money doing.
export default function ClientHome({
  deals,
  meId,
  trustScore,
}: {
  deals: DashboardDeal[]
  meId: string | null
  trustScore: number
}) {
  const [postings, setPostings] = useState<PostingRow[]>([])

  useEffect(() => {
    fetch('/api/opportunities?scope=mine', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : []))
      .then(setPostings)
      .catch(() => {})
  }, [])

  // Only work this user is paying for. Anything they are delivering belongs to
  // their freelancer side.
  const mine = deals.filter((d) => d.buyerId === meId)
  const live = mine.filter((d) => d.status === 'open')
  const active = mine.filter((d) => d.status === 'locked' || d.status === 'submitted')
  const disputed = mine.filter((d) => d.status === 'disputed')
  // Committed money is money that can no longer be spent, whether or not the
  // HTLC has been created yet — counting only on-chain contracts would
  // understate what is actually tied up.
  const escrowBalance = [...active, ...live, ...disputed]
    .filter((d) => d.htlcHashRoot)
    .reduce((sum, d) => sum + Number(d.amountNIM), 0)

  const awaitingReview = active.filter((d) => d.status === 'submitted')
  const openPostings = postings.filter((p) => p.status === 'open')
  const proposalsWaiting = openPostings.reduce((sum, p) => sum + (p._count?.proposals ?? 0), 0)

  const activeRows: DealRow[] = active.map((d) => ({
    id: d.id,
    href: `/dashboard/opportunities/${d.id}`,
    title: d.title,
    status: d.status,
    amountNIM: Number(d.amountNIM),
    note: d.status === 'submitted' ? 'Work delivered — your review releases it' : 'In progress',
  }))

  const postingRows: DealRow[] = openPostings.map((p) => {
    const count = p._count?.proposals ?? 0
    return {
      id: p.id,
      href: `/dashboard/opportunities/${p.id}`,
      title: p.title,
      status: p.status,
      statusTone: 'accent' as const,
      amountNIM: Number(p.amountNIM),
      note:
        count === 0
          ? 'No proposals yet'
          : `${count} proposal${count === 1 ? '' : 's'} waiting on you`,
    }
  })

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Live postings" value={live.length} hint="taking proposals" />
        <StatTile label="In progress" value={active.length} hint="freelancer engaged" />
        <StatTile
          label="In escrow"
          value={escrowBalance.toFixed(2)}
          hint="NIM committed"
          accent={escrowBalance > 0}
        />
        <StatTile label="Trust score" value={`${Math.round(trustScore)}`} hint="out of 100" />
      </div>

      {awaitingReview.length > 0 && (
        <Link href={`/dashboard/opportunities/${awaitingReview[0].id}`}>
          <Card className="mt-3 transition-colors hover:bg-surface">
            <div className="flex items-center justify-between gap-4 p-4">
              <p className="text-[14px] text-secondary-foreground">
                {awaitingReview.length === 1
                  ? 'Work has been delivered and is waiting on your review.'
                  : `${awaitingReview.length} deliveries are waiting on your review.`}
              </p>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </div>
          </Card>
        </Link>
      )}

      {disputed.length > 0 && (
        <Link href="/dashboard/disputes">
          <Card className="mt-3 transition-colors hover:bg-surface">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-2.5">
                <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                <span className="text-[14px] text-secondary-foreground">
                  {disputed.length} deal{disputed.length > 1 ? 's' : ''} in dispute
                </span>
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </Card>
        </Link>
      )}

      <section className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[15px] font-medium tracking-body">Your postings</h2>
          {proposalsWaiting > 0 && (
            <span className="text-[13px] text-muted-foreground">
              {proposalsWaiting} proposal{proposalsWaiting === 1 ? '' : 's'} to review
            </span>
          )}
        </div>
        {postingRows.length === 0 ? (
          <EmptyState
            icon={Plus}
            title="Nothing posted yet"
            description="Describe the work you need, commit the budget to escrow, and pick from the proposals that come in."
            action={
              <Link href="/dashboard/opportunities/new">
                <Button>
                  <Plus className="h-4 w-4" strokeWidth={2.5} />
                  Post your first job
                </Button>
              </Link>
            }
          />
        ) : (
          <DealList rows={postingRows} />
        )}
      </section>

      {activeRows.length > 0 && (
        <section className="mt-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[15px] font-medium tracking-body">Work under way</h2>
            <Link
              href="/dashboard/agreements"
              className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
            >
              View all →
            </Link>
          </div>
          <DealList rows={activeRows} />
        </section>
      )}
    </>
  )
}
