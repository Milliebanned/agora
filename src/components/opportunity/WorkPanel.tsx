'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Scale, Upload, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input, Textarea } from '@/components/ui/input'
import { Spinner } from '@/components/ui/page'
import { formatDate, parseJsonArray } from '@/lib/utils'
import { MESSAGES } from '@/lib/messages'
import type { OpportunityDetail } from './types'

// Delivery and judgement in one place: the freelancer hands work in, the client
// either approves — which releases the escrow — or escalates it to the mediator,
// which reads the submission back against the deliverables in the posting.
export default function WorkPanel({
  opportunity,
  onChanged,
  onNotice,
  onError,
}: {
  opportunity: OpportunityDetail
  onChanged: () => Promise<void>
  onNotice: (message: string) => void
  onError: (message: string) => void
}) {
  const { isClient, isFreelancer } = opportunity.viewer
  const [summary, setSummary] = useState(opportunity.workSubmission ?? '')
  const [links, setLinks] = useState<{ label: string; url: string }[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [showDispute, setShowDispute] = useState(false)
  const [reason, setReason] = useState('')
  const [resubmitting, setResubmitting] = useState(false)

  const deliverables = parseJsonArray(opportunity.deliverables)
  const openDispute = opportunity.disputes.find((d) => d.status !== 'resolved')

  const post = async (url: string, body: unknown) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok) throw new Error(json?.error ?? `Request failed (${res.status})`)
    return json
  }

  const submitWork = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy('submit')
    onError('')
    try {
      await post(`/api/opportunities/${opportunity.id}/submit`, {
        summary,
        attachments: links.filter((l) => l.url.trim()),
      })
      onNotice(MESSAGES.workSubmitted)
      setResubmitting(false)
      setLinks([])
      await onChanged()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not submit the work')
    } finally {
      setBusy(null)
    }
  }

  const approve = async () => {
    setBusy('approve')
    onError('')
    try {
      const result = await post(`/api/opportunities/${opportunity.id}/approve`, {})
      onNotice(result.message ?? MESSAGES.workApproved)
      await onChanged()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not approve the work')
    } finally {
      setBusy(null)
    }
  }

  const raiseDispute = async () => {
    if (reason.trim().length < 10) {
      onError('Say what went wrong — the mediator only sees what is written down.')
      return
    }
    setBusy('dispute')
    onError('')
    try {
      const dispute = await post('/api/disputes', { agreementId: opportunity.id, reason })
      onNotice(MESSAGES.disputeOpened)
      setShowDispute(false)
      window.location.href = `/dashboard/disputes/${dispute.id}`
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not open the dispute')
      setBusy(null)
    }
  }

  const showSubmissionForm =
    isFreelancer &&
    (opportunity.status === 'locked' || (opportunity.status === 'submitted' && resubmitting))

  return (
    <Card>
      <div className="border-b border-border px-5 py-3.5">
        <span className="text-[15px] font-medium tracking-body">Work</span>
      </div>

      <div className="space-y-4 p-5">
        {opportunity.workSubmission && !showSubmissionForm && (
          <div className="rounded-md bg-white/[0.03] p-4">
            <p className="text-[12px] text-subtle-foreground">
              Submitted {opportunity.workSubmittedAt ? formatDate(opportunity.workSubmittedAt) : ''}
            </p>
            <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed text-secondary-foreground">
              {opportunity.workSubmission}
            </p>
          </div>
        )}

        {showSubmissionForm && (
          <form onSubmit={submitWork} className="space-y-3">
            <div>
              <label className="text-[13px] font-medium text-secondary-foreground">
                What did you deliver?
              </label>
              <p className="mt-0.5 text-[12px] text-subtle-foreground">
                Go deliverable by deliverable. This is the text the client approves against, and the
                mediator reads if they do not.
              </p>
              <Textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={6}
                className="mt-2"
                placeholder={
                  deliverables.length > 0
                    ? deliverables.map((d, i) => `${i + 1}. ${d} — `).join('\n')
                    : 'Describe what you handed over.'
                }
                required
              />
            </div>

            {links.map((l, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={l.label}
                  onChange={(e) =>
                    setLinks((prev) =>
                      prev.map((x, idx) => (idx === i ? { ...x, label: e.target.value } : x)),
                    )
                  }
                  placeholder="Live site"
                  className="w-1/3 py-2.5"
                />
                <Input
                  value={l.url}
                  onChange={(e) =>
                    setLinks((prev) =>
                      prev.map((x, idx) => (idx === i ? { ...x, url: e.target.value } : x)),
                    )
                  }
                  placeholder="https://…"
                  type="url"
                  className="py-2.5"
                />
                <button
                  type="button"
                  aria-label="Remove link"
                  onClick={() => setLinks((prev) => prev.filter((_, idx) => idx !== i))}
                  className="flex w-10 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setLinks((prev) => [...prev, { label: '', url: '' }])}
              className="flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
            >
              <Plus className="h-3.5 w-3.5" />
              Add a delivery link
            </button>

            <div className="flex gap-2 pt-1">
              <Button type="submit" disabled={busy !== null}>
                {busy === 'submit' ? <Spinner className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
                {busy === 'submit' ? 'Submitting' : 'Submit for approval'}
              </Button>
              {resubmitting && (
                <Button type="button" variant="secondary" onClick={() => setResubmitting(false)}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        )}

        {isFreelancer && opportunity.status === 'submitted' && !resubmitting && (
          <Button variant="secondary" size="sm" onClick={() => setResubmitting(true)}>
            Revise submission
          </Button>
        )}

        {isFreelancer && opportunity.status !== 'locked' && !opportunity.workSubmission && (
          <p className="text-[14px] text-muted-foreground">
            Nothing to submit while this deal is {opportunity.status}.
          </p>
        )}

        {isClient && opportunity.status === 'locked' && (
          <p className="text-[14px] leading-relaxed text-muted-foreground">
            Waiting on {opportunity.seller?.displayName ?? 'the freelancer'}. Due{' '}
            {new Date(opportunity.deadline).toLocaleDateString()}.
          </p>
        )}

        {isClient && opportunity.status === 'submitted' && (
          <div className="space-y-3">
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              Approving reveals the release secret, which is the only thing that can spend the HTLC.
              It cannot be undone.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={approve} disabled={busy !== null}>
                {busy === 'approve' ? (
                  <Spinner className="h-4 w-4" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {busy === 'approve' ? 'Releasing' : 'Approve & release funds'}
              </Button>
              <Button variant="destructive" onClick={() => setShowDispute(true)}>
                <Scale className="h-4 w-4" />
                Dispute
              </Button>
            </div>
          </div>
        )}

        {opportunity.status === 'completed' && (
          <p className="flex items-center gap-2 text-[14px] text-success">
            <CheckCircle2 className="h-4 w-4" />
            Approved{opportunity.completedAt ? ` on ${formatDate(opportunity.completedAt)}` : ''}.
          </p>
        )}

        {openDispute && (
          <Link
            href={`/dashboard/disputes/${openDispute.id}`}
            className="flex items-center gap-2 text-[14px] text-destructive hover:underline"
          >
            <Scale className="h-4 w-4" />
            This deal is in dispute — open the case
          </Link>
        )}

        {/* Either party can escalate a live engagement: a client whose work never
            arrived, and a freelancer whose client has gone quiet. */}
        {!openDispute &&
          (opportunity.status === 'locked' || opportunity.status === 'submitted') &&
          !showDispute && (
            <button
              onClick={() => setShowDispute(true)}
              className="text-[12px] text-subtle-foreground transition-colors hover:text-destructive"
            >
              Something wrong? Open a dispute →
            </button>
          )}

        {showDispute && (
          <div className="space-y-3 rounded-md border border-destructive/25 bg-destructive/[0.05] p-4">
            <p className="text-[13px] font-medium text-secondary-foreground">
              What went wrong?
            </p>
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              The mediator reads this alongside the original requirements, the timeline, the
              submitted work, and every message in this chat.
            </p>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              placeholder="Be specific about which deliverables are missing or wrong."
            />
            <div className="flex gap-2">
              <Button variant="destructive" onClick={raiseDispute} disabled={busy !== null}>
                {busy === 'dispute' ? <Spinner className="h-4 w-4" /> : <Scale className="h-4 w-4" />}
                Open dispute
              </Button>
              <Button variant="secondary" onClick={() => setShowDispute(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
