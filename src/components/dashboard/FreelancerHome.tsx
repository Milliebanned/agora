'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Compass, Clock, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { StatTile, EmptyState } from '@/components/ui/page'
import DealList, { type DealRow } from './DealList'
import { categoryLabel } from '@/lib/opportunities'
import { cn } from '@/lib/utils'
import type { DashboardDeal } from '@/app/dashboard/page'

interface AppliedRow {
  id: string
  proposals?: Array<{ id: string; status: string; bidNIM: string | number }>
}

interface BoardRow {
  id: string
  title: string
  description: string
  category: string | null
  amountNIM: string | number
  budgetNIM: string | number | null
  timelineDays: number | null
  _count?: { proposals: number }
}

// The freelancer's first screen answers one question: what work is there, and
// where do the things I already put my name on stand.
export default function FreelancerHome({
  deals,
  meId,
  trustScore,
}: {
  deals: DashboardDeal[]
  meId: string | null
  trustScore: number
}) {
  const [pendingApplications, setPendingApplications] = useState<number | null>(null)
  const [board, setBoard] = useState<BoardRow[]>([])
  const [ledger, setLedger] = useState<{
    claimed: number
    mediated: number
    awaitingClaim: number
    paidDeals: number
    awaitingClaimDealIds: string[]
  } | null>(null)

  useEffect(() => {
    fetch('/api/opportunities?scope=applied', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : []))
      .then((rows: AppliedRow[]) =>
        setPendingApplications(
          rows.filter((r) => r.proposals?.some((p) => p.status === 'pending')).length,
        ),
      )
      .catch(() => setPendingApplications(null))

    fetch('/api/opportunities', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : []))
      .then(setBoard)
      .catch(() => {})

    fetch('/api/ledger', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setLedger(data?.freelancer ?? null))
      .catch(() => {})
  }, [])

  // Only work this user is delivering. Anything they posted themselves belongs
  // to their client side and shows up under Deals, not here.
  const mine = deals.filter((d) => d.sellerId === meId)
  const active = mine.filter((d) => d.status === 'locked' || d.status === 'submitted')
  // A deal's status does not change when the escrow is claimed — approving and
  // collecting are different events and only one of them is a payment. Asking
  // the ledger which deals are still unpaid is the only way to stop telling
  // somebody to claim money they already have.
  const claimable = ledger ? mine.filter((d) => ledger.awaitingClaimDealIds.includes(d.id)) : []
  const readyToClaim = ledger?.awaitingClaim ?? 0
  // Collected, not merely approved. A completed deal whose escrow is still
  // unclaimed is money waiting, not money earned, and the tile below says so
  // separately.
  const earned = ledger ? ledger.claimed + ledger.mediated : 0

  const activeRows: DealRow[] = active.map((d) => ({
    id: d.id,
    href: `/dashboard/opportunities/${d.id}`,
    title: d.title,
    status: d.status,
    amountNIM: Number(d.amountNIM),
    note: d.status === 'submitted' ? 'Waiting on the client to review' : 'In progress',
  }))

  const recommended = board.filter((row) => !mine.some((d) => d.id === row.id)).slice(0, 4)

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Active work" value={active.length} hint="in progress" />
        <StatTile
          label="Applications out"
          value={pendingApplications ?? '—'}
          hint="awaiting a decision"
        />
        <StatTile
          label="Ready to claim"
          value={readyToClaim.toFixed(2)}
          hint="NIM approved, not yet collected"
          accent={readyToClaim > 0}
        />
        <StatTile label="Trust score" value={`${Math.round(trustScore)}`} hint="out of 100" />
      </div>

      {/* What the work actually paid. Separate from the row above because
          everything there is a count of things in flight, and this is money
          already in the wallet. */}
      {ledger && (earned > 0 || readyToClaim > 0) && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <StatTile
            label="Earned"
            value={earned.toFixed(2)}
            hint={`NIM collected across ${ledger.paidDeals} deal${ledger.paidDeals === 1 ? '' : 's'}`}
            accent={earned > 0}
          />
          <StatTile
            label="After mediation"
            value={ledger.mediated.toFixed(2)}
            hint="NIM of that from settled disputes"
          />
        </div>
      )}

      {claimable.length > 0 && (
        <Link href={`/dashboard/opportunities/${claimable[0].id}`}>
          <Card className="mt-3 transition-colors hover:bg-surface">
            <div className="flex items-center justify-between gap-4 p-4">
              <p className="text-[14px] text-secondary-foreground">
                {claimable.length === 1
                  ? 'A client approved your work. The escrow is yours to claim.'
                  : `${claimable.length} approved deals are waiting to be claimed.`}
              </p>
              <span className="shrink-0 font-mono text-[13px] tabular-nums text-[#98fb98]">
                {readyToClaim.toFixed(2)} NIM
              </span>
            </div>
          </Card>
        </Link>
      )}

      <section className="mt-10">
        <h2 className="mb-4 text-[15px] font-medium tracking-body">Work in progress</h2>
        {activeRows.length === 0 ? (
          <EmptyState
            icon={Compass}
            title="Nothing on your plate yet"
            description={
              earned > 0
                ? 'No work in flight right now. The board is where the next one starts.'
                : 'Every posting on the board has its budget committed to escrow already, so the money is there before you write a proposal.'
            }
            action={
              <Link href="/dashboard/opportunities">
                <Button>
                  <Compass className="h-4 w-4" />
                  Find work
                </Button>
              </Link>
            }
          />
        ) : (
          <DealList rows={activeRows} />
        )}
      </section>

      {recommended.length > 0 && (
        <section className="mt-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[15px] font-medium tracking-body">Open for proposals</h2>
            <Link
              href="/dashboard/opportunities"
              className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
            >
              See all →
            </Link>
          </div>
          <div className="overflow-hidden rounded-lg shadow-hairline">
            {recommended.map((row, i) => (
              <Link key={row.id} href={`/dashboard/opportunities/${row.id}`}>
                <div
                  className={cn(
                    'bg-card px-4 py-3.5 transition-colors hover:bg-surface',
                    i > 0 && 'border-t border-border',
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="accent">Funded</Badge>
                        <span className="text-[12px] text-subtle-foreground">
                          {categoryLabel(row.category)}
                        </span>
                      </div>
                      <p className="mt-1.5 truncate text-[14px] text-secondary-foreground">
                        {row.title}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-subtle-foreground">
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
                    <span className="shrink-0 font-mono text-[14px] tabular-nums text-foreground">
                      {Number(row.budgetNIM ?? row.amountNIM).toFixed(0)}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  )
}
