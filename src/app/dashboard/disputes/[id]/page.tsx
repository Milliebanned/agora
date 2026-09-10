'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Scale, ArrowUpRight, CheckCircle2, Clock, AlertTriangle } from 'lucide-react'
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
  freelancerPercent?: number
  openerAccepted: boolean
  respondentAccepted: boolean
  amountNIM: number
  viewerRole: 'client' | 'freelancer'
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
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
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
      const data = await res.json().catch(() => null)
      // The resolve route is written to name its own cause — a missing API key,
      // a rate limit, a model that returned nothing. Replacing all of that with
      // one guess sent us looking at an API key that was never the problem.
      if (!res.ok) {
        throw new Error(
          data?.detail ? `${data.error} — ${data.detail}` : (data?.error ?? `Request failed (${res.status})`),
        )
      }
      setDispute(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setMediating(false)
    }
  }

  const handleAccept = async () => {
    setAccepting(true)
    setError('')
    setNotice('')
    try {
      const res = await fetch(`/api/disputes/${disputeId}/settle`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json()
      if (res.ok) setNotice(data.message)
      else setError(data.error ?? 'The verdict could not be accepted.')

      // Re-read either way. If both parties accepted at the same moment one of
      // them is told a payout is already in progress — which is true, and the
      // refreshed dispute shows it settled rather than leaving them on an error
      // for something that worked.
      const fresh = await fetch(`/api/disputes/${disputeId}`, { credentials: 'include' })
      if (fresh.ok) {
        const next = await fresh.json()
        setDispute(next)
        if (!res.ok && next.status === 'resolved') {
          setError('')
          setNotice('This dispute is settled — the escrow has been paid out on-chain.')
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setAccepting(false)
    }
  }

  if (loading) return <PageLoading />
  if (!dispute) return <PageLoading label="Dispute not found" />

  const isOpener = user?.id === dispute.opener.id
  const isRespondent = user?.id === dispute.respondent.id
  const isParty = isOpener || isRespondent
  const viewerAccepted = isOpener ? dispute.openerAccepted : dispute.respondentAccepted
  const hasVerdict = dispute.status === 'under_review' || dispute.status === 'resolved'

  // Shown to both sides in NIM as well as percent: a split reads very
  // differently as "60%" than as "the 300 NIM you are not getting".
  const percent = dispute.freelancerPercent ?? 0
  const freelancerShare = (dispute.amountNIM * percent) / 100
  const clientShare = dispute.amountNIM - freelancerShare

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

            {typeof dispute.freelancerPercent === 'number' &&
              dispute.recommendedOutcome !== 'escalate' && (
                <div>
                  <p className="mb-2 text-[13px] font-medium text-secondary-foreground">
                    How the escrow would be divided
                  </p>
                  <div className="flex h-2 overflow-hidden rounded-full bg-border">
                    <div
                      className="bg-success"
                      style={{ width: `${dispute.freelancerPercent}%` }}
                    />
                    <div
                      className="bg-accent"
                      style={{ width: `${100 - dispute.freelancerPercent}%` }}
                    />
                  </div>
                  <div className="mt-2.5 flex justify-between text-[13px]">
                    <span className="text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {freelancerShare.toFixed(2)} NIM
                      </span>{' '}
                      to the freelancer ({dispute.freelancerPercent}%)
                    </span>
                    <span className="text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {clientShare.toFixed(2)} NIM
                      </span>{' '}
                      to the client ({100 - dispute.freelancerPercent}%)
                    </span>
                  </div>
                </div>
              )}

            {/* The mediator declined to call it. Nothing to accept, and saying
                so plainly beats offering a button that would refuse. */}
            {dispute.status === 'under_review' && dispute.recommendedOutcome === 'escalate' && (
              <div className="flex gap-2.5 rounded-md border border-destructive/25 bg-destructive/[0.06] p-4">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <p className="text-[13px] leading-relaxed text-secondary-foreground">
                  The mediator judged the evidence too thin to decide, so there is nothing to
                  accept. The escrow stays held. Add whatever is missing to the deal chat and
                  request a fresh verdict, or settle it between yourselves.
                </p>
              </div>
            )}

            {dispute.status === 'under_review' && dispute.recommendedOutcome !== 'escalate' && (
              <div className="rounded-md border border-accent/25 bg-accent/[0.06] p-4">
                <p className="text-[13px] leading-relaxed text-secondary-foreground">
                  <span className="font-medium text-accent">This is a recommendation.</span> No NIM
                  moves until both of you accept it. The moment the second acceptance lands, the
                  escrow pays out on-chain as shown above — there is no undo.
                </p>

                <div className="mt-4 space-y-2">
                  {[
                    [dispute.opener.displayName, dispute.openerAccepted, isOpener],
                    [dispute.respondent.displayName, dispute.respondentAccepted, isRespondent],
                  ].map(([name, accepted, isYou]) => (
                    <div key={name as string} className="flex items-center gap-2 text-[13px]">
                      {accepted ? (
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />
                      ) : (
                        <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      )}
                      <span className="text-secondary-foreground">
                        {isYou ? 'You' : (name as string)}
                      </span>
                      <span className="text-muted-foreground">
                        {accepted ? 'accepted' : 'has not accepted yet'}
                      </span>
                    </div>
                  ))}
                </div>

                {viewerAccepted ? (
                  <p className="mt-4 text-[13px] text-muted-foreground">
                    You have accepted. Waiting on the other party.
                  </p>
                ) : (
                  isParty && (
                    <Button className="mt-4" onClick={handleAccept} disabled={accepting}>
                      {accepting ? <Spinner className="h-4 w-4" /> : <Scale className="h-4 w-4" />}
                      {accepting ? 'Recording your acceptance' : 'Accept this verdict'}
                    </Button>
                  )
                )}
              </div>
            )}

            {dispute.status === 'resolved' && (
              <div className="flex items-start gap-2.5 rounded-md border border-success/25 bg-success/[0.06] p-4">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                <p className="text-[13px] leading-relaxed text-secondary-foreground">
                  Both parties accepted the verdict and the escrow was paid out on-chain
                  {typeof dispute.freelancerPercent === 'number' && (
                    <>
                      {' '}
                      — {freelancerShare.toFixed(2)} NIM to the freelancer,{' '}
                      {clientShare.toFixed(2)} NIM to the client
                    </>
                  )}
                  .
                </p>
              </div>
            )}

            {notice && <p className="text-[13px] text-success">{notice}</p>}
            {error && <p className="text-[13px] text-destructive">{error}</p>}
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
