'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { FileText, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/badge'
import { PageHeader, EmptyState, PageLoading } from '@/components/ui/page'
import { cn } from '@/lib/utils'

interface Agreement {
  id: string
  title: string
  status: string
  amountNIM: number
  deadline: string
  buyerId: string
  sellerId: string | null
  buyer?: { displayName: string }
  seller?: { displayName: string }
}

const FILTERS = ['all', 'draft', 'active', 'completed', 'disputed']

export default function AgreementsPage() {
  const router = useRouter()
  const [agreements, setAgreements] = useState<Agreement[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

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
        setAgreements(await res.json())
      } catch (err) {
        console.error('Failed to load agreements:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [filter, router])

  return (
    <>
      <PageHeader
        title="Agreements"
        description="Every deal you are party to, funded or otherwise."
        action={
          <Link href="/dashboard/agreements/create">
            <Button>
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              New agreement
            </Button>
          </Link>
        }
      />

      <div className="mb-5 flex flex-wrap gap-1.5">
        {FILTERS.map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={cn(
              'h-7 rounded-full px-3 text-[13px] transition-colors',
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
      ) : agreements.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={filter === 'all' ? 'No agreements yet' : `No ${filter} agreements`}
          description={
            filter === 'all'
              ? 'Describe a deal in plain English and let AI draft the contract.'
              : 'Try a different filter, or create a new agreement.'
          }
          action={
            <Link href="/dashboard/agreements/create">
              <Button>
                <Plus className="h-4 w-4" strokeWidth={2.5} />
                Create agreement
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg shadow-hairline">
          {agreements.map((a, i) => (
            <Link key={a.id} href={`/dashboard/agreements/${a.id}`}>
              <div
                className={cn(
                  'bg-card px-4 py-4 transition-colors hover:bg-surface',
                  i > 0 && 'border-t border-border',
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5">
                      <StatusBadge status={a.status} />
                      <span className="truncate text-[15px] font-medium tracking-body">
                        {a.title}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[13px] text-muted-foreground">
                      {a.sellerId ? `with ${a.seller?.displayName ?? 'counterparty'}` : 'Awaiting seller'}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-[14px] tabular-nums text-foreground">
                      {Number(a.amountNIM).toFixed(2)} NIM
                    </p>
                    <p className="mt-1 text-[12px] text-subtle-foreground">
                      due {new Date(a.deadline).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  )
}
