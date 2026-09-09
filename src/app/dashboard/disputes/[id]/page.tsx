'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Scale, ArrowUpRight, CheckCircle2 } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge, StatusBadge, type BadgeProps } from '@/components/ui/badge'
import { PageLoading, Spinner } from '@/components/ui/page'

interface Dispute {
  id: string
  status: string
  reason: string
  caseSummary?: string
  findings?: string
  recommendedOutcome?: string
  createdAt: string
  opener: { displayName: string; id: string }
  respondent: { displayName: string; id: string }
  agreement: { id: string; title: string; description: string }
}

const VERDICT_TONE: Record<string, BadgeProps['tone']> = {
  release: 'success',
  refund: 'info',
  partial_refund: 'accent',
  escalate: 'danger',
}

export default function DisputeDetailPage() {
  const router = useRouter()
  const params = useParams()
  const disputeId = params.id as string

  const [dispute, setDispute] = useState<Dispute | null>(null)
  const [loading, setLoading] = useState(true)
  const [mediating, setMediating] = useState(false)
  const [error, setError] = useState('')
  const [user, setUser] = useState<{ id: string } | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/disputes/${disputeId}`, { credentials: 'include' })
        if (!res.ok) {
          router.push('/')
          return
        }
        setDispute(await res.json())

        const sessionRes = await fetch('/api/auth/session', { credentials: 'include' })
        if (sessionRes.ok) setUser((await sessionRes.json()).user)
      } catch (err) {
        console.error('Failed to load dispute:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [disputeId, router])

  const handleGetVerdict = async () => {
    if (!dispute) return
    setMediating(true)
    setError('')
    try {
      const res = await fetch(`/api/disputes/${disputeId}/resolve`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) throw new Error('Could not generate a verdict. Check the AI API key is set.')
      setDispute(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setMediating(false)
    }
  }

  if (loading) return <PageLoading />
  if (!dispute) return <PageLoading label="Dispute not found" />

  const isOpener = user?.id === dispute.opener.id
  const isRespondent = user?.id === dispute.respondent.id
  const hasVerdict = dispute.status === 'under_review' || dispute.status === 'resolved'

  return (
    <>
      <Link
        href="/dashboard/disputes"
        className="mb-6 flex w-fit items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All disputes
      </Link>

      <div className="mb-8 flex items-start justify-between gap-6">
        <div>
          <h1 className="text-heading-sm font-medium tracking-heading">{dispute.agreement.title}</h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            Opened {formatDate(dispute.createdAt)}
          </p>
        </div>
        <StatusBadge status={dispute.status.replace('_', ' ')} />
      </div>

      <Card>
        <div className="grid gap-px bg-border sm:grid-cols-2">
          {[
            ['Opener', dispute.opener.displayName, isOpener],
            ['Respondent', dispute.respondent.displayName, isRespondent],
          ].map(([label, name, isYou]) => (
            <div key={label as string} className="bg-card p-5">
              <p className="text-[13px] text-muted-foreground">{label as string}</p>
              <p className="mt-1.5 flex items-center gap-2 text-[15px] font-medium">
                {name as string}
                {isYou && <Badge tone="accent">You</Badge>}
              </p>
            </div>
          ))}
        </div>
        <div className="border-t border-border p-5">
          <p className="text-[13px] font-medium text-secondary-foreground">Reason for dispute</p>
          <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{dispute.reason}</p>
        </div>
      </Card>

      {dispute.status === 'open' && (
        <Card className="mt-3">
          <div className="flex flex-col items-start gap-4 p-6">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10">
              <Scale className="h-4 w-4 text-accent" />
            </div>
            <div>
              <p className="text-[15px] font-medium tracking-body">AI mediator verdict</p>
              <p className="mt-1.5 max-w-lg text-[14px] leading-relaxed text-muted-foreground">
                The mediator reads the original requirements and deliverables, the delivery
                timeline, the submitted work, and every message between you, then issues a reasoned
                recommendation.
              </p>
            </div>
            <Button onClick={handleGetVerdict} disabled={mediating}>
              {mediating ? <Spinner className="h-4 w-4" /> : <Scale className="h-4 w-4" />}
              {mediating ? 'Reviewing the case' : 'Request verdict'}
            </Button>
            {error && <p className="text-[13px] text-destructive">{error}</p>}
          </div>
        </Card>
      )}

      {hasVerdict && (
        <Card className="mt-3">
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <div className="flex items-center gap-2.5">
              <Scale className="h-4 w-4 text-accent" />
              <span className="text-[15px] font-medium tracking-body">Mediator verdict</span>
            </div>
            <Badge tone={VERDICT_TONE[dispute.recommendedOutcome ?? ''] ?? 'neutral'}>
              {(dispute.recommendedOutcome ?? 'pending').replace('_', ' ')}
            </Badge>
          </div>

          <div className="space-y-6 p-6">
            {dispute.caseSummary && (
              <div>
                <p className="mb-2 text-[13px] font-medium text-secondary-foreground">
                  Case summary
                </p>
                <p className="text-[14px] leading-relaxed text-muted-foreground">
                  {dispute.caseSummary}
                </p>
              </div>
            )}

            {dispute.findings && (
              <div>
                <p className="mb-2 text-[13px] font-medium text-secondary-foreground">Findings</p>
                <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-muted-foreground">
                  {dispute.findings}
                </p>
              </div>
            )}

            {dispute.status === 'under_review' && (
              <div className="rounded-md border border-accent/25 bg-accent/[0.06] p-4">
                <p className="text-[13px] leading-relaxed text-secondary-foreground">
                  <span className="font-medium text-accent">Next step —</span> both parties must
                  accept this verdict for it to be binding.
                </p>
              </div>
            )}

            {dispute.status === 'resolved' && (
              <div className="flex items-center gap-2.5 rounded-md border border-success/25 bg-success/[0.06] p-4">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                <p className="text-[13px] text-secondary-foreground">
                  Dispute resolved — both parties accepted the verdict.
                </p>
              </div>
            )}
          </div>
        </Card>
      )}

      <Link href={`/dashboard/opportunities/${dispute.agreement.id}`}>
        <Card className="mt-3 transition-colors hover:bg-surface">
          <div className="flex items-center justify-between gap-4 p-5">
            <div className="min-w-0">
              <p className="text-[13px] text-muted-foreground">Related opportunity</p>
              <p className="mt-1 truncate text-[15px] font-medium tracking-body">
                {dispute.agreement.title}
              </p>
            </div>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </div>
        </Card>
      </Link>
    </>
  )
}
