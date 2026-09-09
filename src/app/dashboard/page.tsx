'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { FileText, Plus, ArrowUpRight, Compass } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/badge'
import { PageHeader, StatTile, EmptyState, PageLoading } from '@/components/ui/page'
import { ROLE_TAGLINES } from '@/lib/roles'
import type { UserRole } from '@/lib/types'

interface Deal {
  id: string
  title: string
  status: string
  amountNIM: string | number
  deadline: string
  htlcHashRoot?: string | null
  htlcAddress?: string | null
}

export default function DashboardPage() {
  const router = useRouter()
  const [deals, setDeals] = useState<Deal[]>([])
  const [trustScore, setTrustScore] = useState(50)
  const [role, setRole] = useState<UserRole | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const sessionRes = await fetch('/api/auth/session', { credentials: 'include' })
        if (!sessionRes.ok) {
          router.push('/')
          return
        }
        const session = await sessionRes.json()
        setRole(session.user.role ?? null)

        const [dealsRes, profileRes] = await Promise.all([
          fetch('/api/agreements', { credentials: 'include' }),
          fetch(`/api/users/${session.user.id}`, { credentials: 'include' }),
        ])

        if (dealsRes.ok) setDeals(await dealsRes.json())
        if (profileRes.ok) {
          const profile = await profileRes.json()
          setTrustScore(profile?.reputation?.trustScore ?? 50)
        }
      } catch (err) {
        console.error('Failed to load dashboard:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router])

  if (loading) return <PageLoading />

  // Work in flight is anything with a freelancer on it; a posting still taking
  // proposals is counted separately because it needs a different action.
  const active = deals.filter((d) => d.status === 'locked' || d.status === 'submitted')
  const listed = deals.filter((d) => d.status === 'open')
  const disputed = deals.filter((d) => d.status === 'disputed')
  // Committed money is money the client can no longer spend, whether or not the
  // HTLC has been created yet — showing only on-chain contracts would understate
  // what is actually tied up.
  const escrowBalance = [...active, ...listed, ...disputed]
    .filter((d) => d.htlcHashRoot)
    .reduce((sum, d) => sum + Number(d.amountNIM), 0)

  return (
    <>
      <PageHeader
        title="Home"
        description={
          role ? ROLE_TAGLINES[role] : 'Your active deals, escrow, and standing at a glance.'
        }
        action={
          <div className="flex gap-2">
            <Link href="/dashboard/opportunities">
              <Button variant="secondary">
                <Compass className="h-4 w-4" />
                Browse
              </Button>
            </Link>
            <Link href="/dashboard/opportunities/new">
              <Button>
                <Plus className="h-4 w-4" strokeWidth={2.5} />
                Post
              </Button>
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="In progress" value={active.length} hint="freelancer engaged" />
        <StatTile label="Taking proposals" value={listed.length} hint="live on the board" />
        <StatTile
          label="In escrow"
          value={escrowBalance.toFixed(2)}
          hint="NIM committed"
          accent={escrowBalance > 0}
        />
        <StatTile label="Trust score" value={`${Math.round(trustScore)}`} hint="out of 100" />
      </div>

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
          <h2 className="text-[15px] font-medium tracking-body">Recent deals</h2>
          {deals.length > 0 && (
            <Link
              href="/dashboard/agreements"
              className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
            >
              View all →
            </Link>
          )}
        </div>

        {deals.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No deals yet"
            description={
              role === 'provider'
                ? 'Every posting on the board has its budget already committed to escrow, so the money is there before you write a proposal.'
                : 'Describe the work you need, commit the budget to escrow, and pick from the proposals that come in.'
            }
            action={
              role === 'provider' ? (
                <Link href="/dashboard/opportunities">
                  <Button>
                    <Compass className="h-4 w-4" />
                    Browse opportunities
                  </Button>
                </Link>
              ) : (
                <Link href="/dashboard/opportunities/new">
                  <Button>
                    <Plus className="h-4 w-4" strokeWidth={2.5} />
                    Post your first opportunity
                  </Button>
                </Link>
              )
            }
          />
        ) : (
          <div className="overflow-hidden rounded-lg shadow-hairline">
            {deals.slice(0, 5).map((a, i) => (
              <Link key={a.id} href={`/dashboard/opportunities/${a.id}`}>
                <div
                  className={`flex items-center justify-between gap-4 bg-card px-4 py-3.5 transition-colors hover:bg-surface ${
                    i > 0 ? 'border-t border-border' : ''
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <StatusBadge status={a.status} tone={a.status === 'open' ? 'accent' : undefined} />
                    <span className="truncate text-[14px] text-secondary-foreground">
                      {a.title}
                    </span>
                  </div>
                  <span className="shrink-0 font-mono text-[13px] tabular-nums text-muted-foreground">
                    {Number(a.amountNIM).toFixed(2)} NIM
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  )
}
