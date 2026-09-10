'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Scale,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  UserCheck,
  Gavel,
} from 'lucide-react'
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
  openerDecision: string | null
  respondentDecision: string | null
  humanRequestedAt?: string | null
  humanRuling?: string | null
  humanRulingPercent?: number | null
  mediator?: { displayName: string | null } | null
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
  const [accepting, setAccepting] = useState<'accept' | 'reject' | 'human' | 'rule' | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [user, setUser] = useState<{ id: string; isPlatformMediator?: boolean } | null>(null)
  const [ruling, setRuling] = useState('')
  const [rulingPercent, setRulingPercent] = useState('50')

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

  const handleDecision = async (decision: 'accept' | 'reject') => {
    setAccepting(decision)
    setError('')
    setNotice('')
    try {
      const res = await fetch(`/api/disputes/${disputeId}/settle`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      })
      const data = await res.json()
      if (res.ok) setNotice(data.message)
      else setError(data.error ?? 'Your answer could not be recorded.')

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
      setAccepting(null)
    }
  }

  // Either party can ask for a person. Needing the other side's agreement to
  // ask for help would defeat the point of asking.
  const requestHuman = async () => {
    setAccepting('human')
    setError('')
    setNotice('')
    try {
      const res = await fetch(`/api/disputes/${disputeId}/human`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail ? `${data.error} — ${data.detail}` : data.error)
      setNotice(data.message)
      const fresh = await fetch(`/api/disputes/${disputeId}`, { credentials: 'include' })
      if (fresh.ok) setDispute(await fresh.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not request a human mediator')
    } finally {
      setAccepting(null)
    }
  }

  const submitRuling = async () => {
    setAccepting('rule')
    setError('')
    setNotice('')
    try {
      const res = await fetch(`/api/disputes/${disputeId}/rule`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ percent: Number(rulingPercent), reasoning: ruling }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail ? `${data.error} — ${data.detail}` : data.error)
      setNotice(data.message)
      const fresh = await fetch(`/api/disputes/${disputeId}`, { credentials: 'include' })
      if (fresh.ok) setDispute(await fresh.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record the ruling')
    } finally {
      setAccepting(null)
    }
  }

  if (loading) return <PageLoading />
  if (!dispute) return <PageLoading label="Dispute not found" />

  const isOpener = user?.id === dispute.opener.id
  const isRespondent = user?.id === dispute.respondent.id
  const isParty = isOpener || isRespondent
  const viewerDecision = isOpener ? dispute.openerDecision : dispute.respondentDecision
  const wasRejected =
    dispute.openerDecision === 'rejected' || dispute.respondentDecision === 'rejected'
  // Everything about a case after its first verdict lives in one card: the
  // findings, the accept/reject buttons, the human-review notice and the
  // mediator's ruling form. So this list is not cosmetic — a status missing
  // from it hides the only control that status exists to offer, which is how
  // a case referred to a human ended up with no way for the human to rule.
  const hasVerdict = ['under_review', 'resolved', 'escalated', 'human_review'].includes(
    dispute.status,
  )

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
                <div>
                  <p className="text-[13px] leading-relaxed text-secondary-foreground">
                    The mediator judged the evidence too thin to decide, so there is nothing to
                    accept. The escrow stays held. Add whatever is missing to the deal chat and
                    request a fresh verdict, or ask a person to settle it.
                  </p>
                  {isParty && !dispute.humanRequestedAt && (
                    <Button
                      variant="secondary"
                      className="mt-3"
                      onClick={requestHuman}
                      disabled={accepting !== null}
                    >
                      {accepting === 'human' ? (
                        <Spinner className="h-4 w-4" />
                      ) : (
                        <UserCheck className="h-4 w-4" />
                      )}
                      Ask for a human mediator
                    </Button>
                  )}
                </div>
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
                    [dispute.opener.displayName, dispute.openerDecision, isOpener],
                    [dispute.respondent.displayName, dispute.respondentDecision, isRespondent],
                  ].map(([name, answer, isYou]) => (
                    <div key={name as string} className="flex items-center gap-2 text-[13px]">
                      {answer === 'accepted' ? (
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />
                      ) : answer === 'rejected' ? (
                        <XCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />
                      ) : (
                        <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      )}
                      <span className="text-secondary-foreground">
                        {isYou ? 'You' : (name as string)}
                      </span>
                      <span className="text-muted-foreground">
                        {answer === 'accepted'
                          ? 'accepted'
                          : answer === 'rejected'
                            ? 'rejected the verdict'
                            : 'has not answered yet'}
                      </span>
                    </div>
                  ))}
                </div>

                {viewerDecision === 'accepted' ? (
                  <p className="mt-4 text-[13px] text-muted-foreground">
                    You have accepted. Waiting on the other party.
                  </p>
                ) : (
                  isParty && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        onClick={() => handleDecision('accept')}
                        disabled={accepting !== null}
                      >
                        {accepting === 'accept' ? (
                          <Spinner className="h-4 w-4" />
                        ) : (
                          <Scale className="h-4 w-4" />
                        )}
                        {accepting === 'accept' ? 'Recording' : 'Accept this verdict'}
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => handleDecision('reject')}
                        disabled={accepting !== null}
                      >
                        {accepting === 'reject' ? (
                          <Spinner className="h-4 w-4" />
                        ) : (
                          <XCircle className="h-4 w-4" />
                        )}
                        {accepting === 'reject' ? 'Recording' : 'Reject'}
                      </Button>
                    </div>
                  )
                )}
                <p className="mt-3 text-[12px] leading-relaxed text-subtle-foreground">
                  Rejecting moves no money and does not end the dispute. It ends this verdict — you
                  can then add what the mediator missed to the deal chat and request a fresh one.
                </p>
              </div>
            )}

            {dispute.status === 'escalated' && (
              <div className="rounded-md border border-destructive/25 bg-destructive/[0.06] p-4">
                <div className="flex gap-2.5">
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  <div>
                    <p className="text-[13px] font-medium text-destructive">Verdict rejected</p>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-secondary-foreground">
                      This verdict is not binding and <span className="font-medium">no funds have
                      moved</span> — the escrow is still held. Add whatever the mediator did not see
                      to the deal chat, then request a fresh verdict. Both of you will be asked
                      again from scratch.
                    </p>
                  </div>
                </div>
                {isParty && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button onClick={handleGetVerdict} disabled={mediating || accepting !== null}>
                      {mediating ? <Spinner className="h-4 w-4" /> : <Scale className="h-4 w-4" />}
                      {mediating ? 'Reviewing the case again' : 'Request a fresh verdict'}
                    </Button>
                    {!dispute.humanRequestedAt && (
                      <Button
                        variant="secondary"
                        onClick={requestHuman}
                        disabled={mediating || accepting !== null}
                      >
                        {accepting === 'human' ? (
                          <Spinner className="h-4 w-4" />
                        ) : (
                          <UserCheck className="h-4 w-4" />
                        )}
                        Ask for a human mediator
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}

            {dispute.status === 'human_review' && (
              <div className="rounded-md border border-violet/25 bg-violet/[0.06] p-4">
                <div className="flex gap-2.5">
                  <UserCheck className="mt-0.5 h-4 w-4 shrink-0 text-violet" />
                  <div>
                    <p className="text-[13px] font-medium text-violet">With a human mediator</p>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-secondary-foreground">
                      A person is reviewing this case against the requirements, the work and this
                      chat. Their ruling is binding and releases the escrow, so add anything they
                      should see to the deal chat now. The escrow stays held until they decide.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* The mediator's desk. Only rendered for a wallet named in
                PLATFORM_ADMIN_ADDRESSES, and the route checks again — this is
                convenience, not the access control. */}
            {user?.isPlatformMediator && !isParty && dispute.status !== 'resolved' && (
              <div className="rounded-md border border-accent/25 bg-accent/[0.06] p-4">
                <p className="text-[13px] font-medium text-accent">Rule on this dispute</p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-secondary-foreground">
                  Your decision is <span className="font-medium">binding and immediate</span> — it
                  pays out on-chain the moment you submit, with no acceptance step and no undo.
                  Both parties will read your reasoning.
                </p>

                <label className="mt-4 block text-[13px] font-medium text-secondary-foreground">
                  Freelancer’s share: {rulingPercent}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={rulingPercent}
                  onChange={(e) => setRulingPercent(e.target.value)}
                  className="mt-2 w-full accent-accent"
                />
                <div className="mt-1 flex justify-between text-[12px] text-muted-foreground">
                  <span>
                    {((dispute.amountNIM * Number(rulingPercent)) / 100).toFixed(2)} NIM to the
                    freelancer
                  </span>
                  <span>
                    {(dispute.amountNIM - (dispute.amountNIM * Number(rulingPercent)) / 100).toFixed(
                      2,
                    )}{' '}
                    NIM to the client
                  </span>
                </div>

                <textarea
                  value={ruling}
                  onChange={(e) => setRuling(e.target.value)}
                  rows={4}
                  placeholder="What decided it? Cite the deliverables, the dates, the work as submitted. Both parties read this, and one of them is losing money because of it."
                  className="mt-4 w-full rounded-md border border-border bg-card p-3 text-[14px] leading-relaxed outline-none transition-colors focus:border-accent"
                />

                <Button
                  className="mt-3"
                  onClick={submitRuling}
                  disabled={accepting !== null || ruling.trim().length < 20}
                >
                  {accepting === 'rule' ? (
                    <Spinner className="h-4 w-4" />
                  ) : (
                    <Gavel className="h-4 w-4" />
                  )}
                  {accepting === 'rule' ? 'Settling on-chain' : 'Issue binding ruling'}
                </Button>
                {ruling.trim().length < 20 && (
                  <p className="mt-2 text-[12px] text-subtle-foreground">
                    Reasoning is required — at least a sentence.
                  </p>
                )}
              </div>
            )}

            {user?.isPlatformMediator && isParty && dispute.status !== 'resolved' && (
              <div className="rounded-md border border-border bg-surface p-4">
                <p className="text-[13px] leading-relaxed text-muted-foreground">
                  You are a platform mediator, but you are also a party to this dispute, so you
                  cannot rule on it. Another mediator has to take this one.
                </p>
              </div>
            )}

            {dispute.humanRuling && (
              <div className="rounded-md border border-success/25 bg-success/[0.06] p-4">
                <div className="flex items-center gap-2">
                  <Gavel className="h-4 w-4 shrink-0 text-success" />
                  <p className="text-[13px] font-medium text-success">
                    Human mediator’s ruling — {dispute.humanRulingPercent}% to the freelancer
                  </p>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-secondary-foreground">
                  {dispute.humanRuling}
                </p>
                {dispute.mediator?.displayName && (
                  <p className="mt-2 text-[12px] text-muted-foreground">
                    Ruled by {dispute.mediator.displayName}. This decision was final.
                  </p>
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
