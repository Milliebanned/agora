'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Compass, Send, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/badge'
import { PageHeader, EmptyState, PageLoading } from '@/components/ui/page'
import { useSession } from '@/components/SessionProvider'
import { categoryLabel } from '@/lib/opportunities'
import { cn } from '@/lib/utils'

interface AppliedRow {
  id: string
  title: string
  category: string | null
  status: string
  amountNIM: string | number
  budgetNIM: string | number | null
  timelineDays: number | null
  sellerId: string | null
  buyer?: { displayName: string | null }
  proposals?: Array<{
    id: string
    status: string
    bidNIM: string | number
    deliveryDays: number
    createdAt: string
  }>
}

// What the client is doing about your pitch, in the words you would use to
// describe it out loud.
function outcome(proposalStatus: string, won: boolean): { label: string; note: string } {
  if (proposalStatus === 'accepted' || won)
    return { label: 'accepted', note: 'You won this one — the work is yours' }
  if (proposalStatus === 'rejected')
    return { label: 'rejected', note: 'The client went with someone else' }
  if (proposalStatus === 'withdrawn')
    return { label: 'withdrawn', note: 'You pulled this application' }
  return { label: 'pending', note: 'Waiting on the client to decide' }
}

export default function ApplicationsPage() {
  const router = useRouter()
  const { role, loading: sessionLoading } = useSession()
  const [rows, setRows] = useState<AppliedRow[]>([])
  const [loading, setLoading] = useState(true)

  // Applications belong to the freelancer side. Someone who switched to client
  // while standing here gets sent home rather than shown an empty shell.
  useEffect(() => {
    if (sessionLoading) return
    if (role && role !== 'provider') router.replace('/dashboard')
  }, [role, sessionLoading, router])

  useEffect(() => {
    if (sessionLoading || role !== 'provider') return
    fetch('/api/opportunities?scope=applied', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : []))
      .then(setRows)
      .catch((err) => console.error('Failed to load applications:', err))
      .finally(() => setLoading(false))
  }, [role, sessionLoading])

  if (sessionLoading || (loading && role === 'provider')) {
    return <PageLoading label="Loading your applications" />
  }

  const pending = rows.filter((r) => r.proposals?.[0]?.status === 'pending').length

  return (
    <>
      <PageHeader
        title="Applications"
        description={
          rows.length === 0
            ? 'Every proposal you send shows up here with where it stands.'
            : `${rows.length} sent${pending > 0 ? `, ${pending} still waiting on a decision` : ''}.`
        }
        action={
          <Link href="/dashboard/opportunities">
            <Button variant="secondary">
              <Compass className="h-4 w-4" />
              Find work
            </Button>
          </Link>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={Send}
          title="You have not applied to anything yet"
          description="Every posting on the board has its budget committed to escrow already, so the money is there before you write a proposal."
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
        <div className="overflow-hidden rounded-lg shadow-hairline">
          {rows.map((row, i) => {
            const proposal = row.proposals?.[0]
            const { label, note } = outcome(proposal?.status ?? 'pending', Boolean(row.sellerId))
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
                        <StatusBadge status={label} />
                        <span className="text-[12px] text-subtle-foreground">
                          {categoryLabel(row.category)}
                        </span>
                      </div>
                      <p className="mt-2 truncate text-[15px] font-medium tracking-body">
                        {row.title}
                      </p>
                      <p className="mt-1 text-[13px] text-muted-foreground">{note}</p>
                      {proposal && (
                        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-subtle-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {proposal.deliveryDays}d delivery
                          </span>
                          <span>
                            Budget {Number(row.budgetNIM ?? row.amountNIM).toFixed(0)} NIM
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-mono text-[15px] tabular-nums text-foreground">
                        {Number(proposal?.bidNIM ?? row.amountNIM).toFixed(0)}
                      </p>
                      <p className="mt-0.5 text-[11px] text-subtle-foreground">your bid</p>
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
