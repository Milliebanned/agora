'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { FileText, Plus, ArrowUpRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/badge'
import { PageHeader, StatTile, EmptyState, PageLoading } from '@/components/ui/page'

interface Agreement {
  id: string
  title: string
  status: string
  amountNIM: number
  deadline: string
  htlcAddress?: string | null
}

export default function DashboardPage() {
  const router = useRouter()
  const [agreements, setAgreements] = useState<Agreement[]>([])
  const [trustScore, setTrustScore] = useState(50)
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

        const [agreementsRes, profileRes] = await Promise.all([
          fetch('/api/agreements', { credentials: 'include' }),
          fetch(`/api/users/${session.user.id}`, { credentials: 'include' }),
        ])

        if (agreementsRes.ok) setAgreements(await agreementsRes.json())
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

  const active = agreements.filter((a) => a.status === 'active')
  const pending = agreements.filter((a) => a.status === 'draft')
  const disputed = agreements.filter((a) => a.status === 'disputed')
  const escrowBalance = active
    .filter((a) => a.htlcAddress)
    .reduce((sum, a) => sum + Number(a.amountNIM), 0)

  return (
    <>
      <PageHeader
        title="Home"
        description="Your active deals, escrow, and standing at a glance."
        action={
          <Link href="/dashboard/agreements/create">
            <Button size="default">
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              New agreement
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Active" value={active.length} />
        <StatTile label="Pending" value={pending.length} />
        <StatTile
          label="In escrow"
          value={escrowBalance.toFixed(2)}
          hint="NIM locked in HTLCs"
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
                  {disputed.length} agreement{disputed.length > 1 ? 's' : ''} in dispute
                </span>
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </Card>
        </Link>
      )}

      <section className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[15px] font-medium tracking-body">Recent agreements</h2>
          {agreements.length > 0 && (
            <Link
              href="/dashboard/agreements"
              className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
            >
              View all →
            </Link>
          )}
        </div>

        {agreements.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No agreements yet"
            description="Describe a deal in plain English and let AI draft the contract, then lock the payment in escrow."
            action={
              <Link href="/dashboard/agreements/create">
                <Button>
                  <Plus className="h-4 w-4" strokeWidth={2.5} />
                  Create your first agreement
                </Button>
              </Link>
            }
          />
        ) : (
          <div className="overflow-hidden rounded-lg shadow-hairline">
            {agreements.slice(0, 5).map((a, i) => (
              <Link key={a.id} href={`/dashboard/agreements/${a.id}`}>
                <div
                  className={`flex items-center justify-between gap-4 bg-card px-4 py-3.5 transition-colors hover:bg-surface ${
                    i > 0 ? 'border-t border-border' : ''
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <StatusBadge status={a.status} />
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
