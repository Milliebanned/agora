'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Scale } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { StatusBadge } from '@/components/ui/badge'
import { PageHeader, EmptyState, PageLoading } from '@/components/ui/page'
import { cn } from '@/lib/utils'

interface Dispute {
  id: string
  status: string
  reason: string
  createdAt: string
  agreement: { id: string; title: string }
  opener: { displayName: string }
  respondent: { displayName: string }
}

export default function DisputesPage() {
  const router = useRouter()
  const [disputes, setDisputes] = useState<Dispute[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/disputes', { credentials: 'include' })
        if (!res.ok) {
          router.push('/')
          return
        }
        setDisputes(await res.json())
      } catch (err) {
        console.error('Failed to load disputes:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router])

  if (loading) return <PageLoading />

  return (
    <>
      <PageHeader
        title="Disputes"
        description="Cases under review, and the AI mediator's verdicts."
      />

      {disputes.length === 0 ? (
        <EmptyState
          icon={Scale}
          title="No disputes"
          description="If a deal stalls, either party can open a dispute. The AI mediator reads the submitted work against the original requirements, the timeline, and the whole message history, then issues a reasoned verdict."
        />
      ) : (
        <div className="overflow-hidden rounded-lg shadow-hairline">
          {disputes.map((d, i) => (
            <Link key={d.id} href={`/dashboard/disputes/${d.id}`}>
              <div
                className={cn(
                  'bg-card px-4 py-4 transition-colors hover:bg-surface',
                  i > 0 && 'border-t border-border',
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5">
                      <StatusBadge status={d.status.replace('_', ' ')} />
                      <span className="truncate text-[15px] font-medium tracking-body">
                        {d.agreement.title}
                      </span>
                    </div>
                    <p className="mt-1.5 line-clamp-1 text-[13px] text-muted-foreground">
                      {d.reason}
                    </p>
                    <p className="mt-1 text-[12px] text-subtle-foreground">
                      {d.opener.displayName} vs {d.respondent.displayName}
                    </p>
                  </div>
                  <span className="shrink-0 text-[12px] text-subtle-foreground">
                    {formatDate(d.createdAt)}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  )
}
