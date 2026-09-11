'use client'

import { useState } from 'react'
import { Send, Check, X, Star, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input, Textarea } from '@/components/ui/input'
import { Spinner } from '@/components/ui/page'
import { formatDate, shortAddress, cn } from '@/lib/utils'
import { getBlockNumber, sendBasicTransaction } from '@/lib/nimiq'
import { MESSAGES } from '@/lib/messages'
import type { OpportunityDetail, ProposalRow } from './types'

// Two views of the same table. The client is choosing; the freelancer is
// pitching. Neither sees the other's side of it: rival bids stay private, and a
// pitch is not a chat thread.
export default function ProposalPanel({
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
  const { isClient } = opportunity.viewer
  const budget = Number(opportunity.budgetNIM ?? opportunity.amountNIM)
  const mine = opportunity.proposals.find((p) => p.freelancerId === opportunity.viewer.id)

  return isClient ? (
    <ClientView
      opportunity={opportunity}
      onChanged={onChanged}
      onNotice={onNotice}
      onError={onError}
    />
  ) : (
    <FreelancerView
      opportunity={opportunity}
      budget={budget}
      existing={mine}
      onChanged={onChanged}
      onNotice={onNotice}
      onError={onError}
    />
  )
}

function TrustPill({ proposal }: { proposal: ProposalRow }) {
  const score = proposal.freelancer.reputationScores?.trustScore
  const done = proposal.freelancer.reputationScores?.completedAgreements ?? 0
  return (
    <span className="flex items-center gap-1 text-[12px] text-subtle-foreground">
      <Star className="h-3 w-3" />
      {score ?? 50}/100 · {done} completed
    </span>
  )
}

function ClientView({
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
  const [busy, setBusy] = useState<string | null>(null)
  const open = opportunity.status === 'open'
  const funded = Number(opportunity.amountNIM)

  const decide = async (proposal: ProposalRow, action: 'accept' | 'reject') => {
    setBusy(proposal.id)
    onError('')
    try {
      const bid = Number(proposal.bidNIM)
      // The head of the chain comes from the device, because the timeout the
      // HTLC will enforce is measured in blocks, not wall-clock time.
      const currentBlock = action === 'accept' ? await getBlockNumber() : undefined

      const attempt = async (serialized?: string, txHash?: string) => {
        const res = await fetch(
          `/api/opportunities/${opportunity.id}/proposals/${proposal.id}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ action, currentBlock, serialized, txHash }),
          },
        )
        return { res, body: await res.json().catch(() => null) }
      }

      // Always ask first, before touching the wallet. A bid within budget
      // locks on this one call. A bid above it comes back naming exactly what
      // is owed — or, if a top-up for this proposal is already on file from
      // an earlier attempt, resumes confirming that instead. The wallet is
      // only ever asked to sign after the server has just said, in this same
      // round trip, that nothing has been paid yet — that ordering is what
      // stops a failed request from turning into a second real payment.
      let { res, body } = await attempt()

      let topupPaidNow = false
      if (res.status === 400 && typeof body?.topupNeeded === 'number') {
        const topupNeeded = body.topupNeeded
        const destRes = await fetch(
          `/api/opportunities/${opportunity.id}/escrow?amountNIM=${topupNeeded}`,
          { credentials: 'include' },
        )
        const destination = await destRes.json().catch(() => null)
        if (!destRes.ok) {
          throw new Error(destination?.error ?? 'Could not look up where to send the top-up')
        }

        const transfer = await sendBasicTransaction({
          recipient: destination.escrowAddress,
          value: destination.amountLuna,
        })
        if (!transfer.ok) {
          onError(transfer.reason ?? 'The wallet did not send the top-up payment.')
          return
        }
        topupPaidNow = true
        ;({ res, body } = await attempt(transfer.serialized ?? undefined, transfer.txHash ?? undefined))
      }

      if (res.status === 202 && body?.pending) {
        // The top-up landed in the mempool but is not in a block yet. Nothing
        // failed and nothing should be paid again — just try the same accept
        // once it has confirmed; the same ask-first call above resumes it.
        onNotice(body.message)
        return
      }
      if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`)

      if (action === 'accept') {
        const name = proposal.freelancer.displayName ?? 'The freelancer'
        let message = `${name} is in. Create the HTLC to lock ${bid.toFixed(2)} NIM on-chain — the chat is open in the meantime.`
        if (topupPaidNow) {
          message += ` You funded the extra amount above budget to make it happen.`
        } else if (body?.refund?.ok) {
          message += ` ${Number(body.refund.amountNIM).toFixed(2)} NIM was refunded to you — the accepted bid came in under budget.`
        } else if (body?.refund && !body.refund.ok) {
          onError(
            `Accepted, but the ${Number(body.refund.amountNIM).toFixed(2)} NIM refund for the difference could not be sent automatically — it will be sent by hand shortly.`,
          )
        }
        onNotice(message)
      } else {
        onNotice(MESSAGES.proposalDeclined)
      }
      await onChanged()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not update the proposal')
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <span className="text-[15px] font-medium tracking-body">
          Proposals ({opportunity.proposals.length})
        </span>
        {open && <Badge tone="info">Taking proposals</Badge>}
      </div>

      {opportunity.proposals.length === 0 ? (
        <p className="px-5 py-10 text-center text-[14px] text-muted-foreground">
          {opportunity.status === 'draft'
            ? 'Commit the budget to put this on the board — freelancers only see funded work.'
            : 'No proposals yet.'}
        </p>
      ) : (
        <div>
          {opportunity.proposals.map((p, i) => (
            <div key={p.id} className={cn('px-5 py-4', i > 0 && 'border-t border-border')}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[14px] font-medium text-secondary-foreground">
                      {p.freelancer.displayName ?? shortAddress(p.freelancer.address)}
                    </span>
                    {p.status !== 'pending' && (
                      <Badge tone={p.status === 'accepted' ? 'success' : 'neutral'}>
                        {p.status}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-3">
                    <TrustPill proposal={p} />
                    <span className="text-[12px] text-subtle-foreground">
                      {formatDate(p.createdAt)}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-mono text-[15px] tabular-nums text-foreground">
                    {Number(p.bidNIM).toFixed(2)} NIM
                  </p>
                  <p className="mt-0.5 flex items-center justify-end gap-1 text-[12px] text-subtle-foreground">
                    <Clock className="h-3 w-3" />
                    {p.deliveryDays} days
                  </p>
                </div>
              </div>

              <p className="mt-3 whitespace-pre-wrap text-[13px] leading-relaxed text-muted-foreground">
                {p.coverLetter}
              </p>

              {(() => {
                const topup = Math.max(0, Number(p.bidNIM) - funded)
                return (
                  <>
                    {topup > 0 && p.status === 'pending' && (
                      <p className="mt-2 text-[12px] text-[#98fb98]">
                        {topup.toFixed(2)} NIM above what&apos;s funded — accepting will ask you to
                        pay the difference.
                      </p>
                    )}
                    {open && p.status === 'pending' && (
                      <div className="mt-3.5 flex gap-2">
                        <Button size="sm" disabled={busy !== null} onClick={() => decide(p, 'accept')}>
                          {busy === p.id ? (
                            <Spinner className="h-3.5 w-3.5" />
                          ) : (
                            <Check className="h-3.5 w-3.5" />
                          )}
                          {topup > 0
                            ? `Fund ${topup.toFixed(2)} NIM & accept`
                            : 'Accept & lock escrow'}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={busy !== null}
                          onClick={() => decide(p, 'reject')}
                        >
                          <X className="h-3.5 w-3.5" />
                          Decline
                        </Button>
                      </div>
                    )}
                  </>
                )
              })()}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

function FreelancerView({
  opportunity,
  budget,
  existing,
  onChanged,
  onNotice,
  onError,
}: {
  opportunity: OpportunityDetail
  budget: number
  existing?: ProposalRow
  onChanged: () => Promise<void>
  onNotice: (message: string) => void
  onError: (message: string) => void
}) {
  const [coverLetter, setCoverLetter] = useState(existing?.coverLetter ?? '')
  const [bid, setBid] = useState(existing ? String(Number(existing.bidNIM)) : String(budget))
  const [days, setDays] = useState(
    existing ? String(existing.deliveryDays) : String(opportunity.timelineDays ?? 7),
  )
  const [editing, setEditing] = useState(!existing)
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    onError('')
    try {
      const res = await fetch(`/api/opportunities/${opportunity.id}/proposals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          coverLetter,
          bidNIM: Number(bid),
          deliveryDays: Number(days),
        }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.error ?? `Could not send the proposal (${res.status})`)
      onNotice(existing ? MESSAGES.applicationUpdated : MESSAGES.applicationSent)
      setEditing(false)
      await onChanged()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not send the proposal')
    } finally {
      setSaving(false)
    }
  }

  if (existing && !editing) {
    return (
      <Card>
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <span className="text-[15px] font-medium tracking-body">Your proposal</span>
          <Badge tone={existing.status === 'accepted' ? 'success' : existing.status === 'pending' ? 'info' : 'neutral'}>
            {existing.status}
          </Badge>
        </div>
        <div className="p-5">
          <div className="flex gap-6">
            <div>
              <p className="text-[12px] text-muted-foreground">Your bid</p>
              <p className="font-mono text-[16px] tabular-nums">
                {Number(existing.bidNIM).toFixed(2)} NIM
              </p>
            </div>
            <div>
              <p className="text-[12px] text-muted-foreground">Delivery</p>
              <p className="text-[16px]">{existing.deliveryDays} days</p>
            </div>
          </div>
          <p className="mt-4 whitespace-pre-wrap text-[13px] leading-relaxed text-muted-foreground">
            {existing.coverLetter}
          </p>
          {existing.status === 'pending' && opportunity.status === 'open' && (
            <Button variant="secondary" size="sm" className="mt-4" onClick={() => setEditing(true)}>
              Revise proposal
            </Button>
          )}
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <div className="border-b border-border px-5 py-3.5">
        <span className="text-[15px] font-medium tracking-body">
          {existing ? 'Revise your proposal' : 'Submit a proposal'}
        </span>
      </div>
      <form onSubmit={submit} className="space-y-4 p-5">
        <div>
          <label className="text-[13px] font-medium text-secondary-foreground">
            How would you approach this?
          </label>
          <Textarea
            value={coverLetter}
            onChange={(e) => setCoverLetter(e.target.value)}
            rows={5}
            className="mt-2"
            placeholder="What you would build, how you would sequence it, and anything relevant you have done before."
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[13px] font-medium text-secondary-foreground">Your bid</label>
            <Input
              type="number"
              inputMode="decimal"
              min="1"
              step="any"
              value={bid}
              onChange={(e) => setBid(e.target.value)}
              className="mt-2"
              required
            />
            <p
              className={cn(
                'mt-1 text-[12px]',
                Number(bid) > budget ? 'text-[#98fb98]' : 'text-subtle-foreground',
              )}
            >
              {Number(bid) > budget
                ? `${(Number(bid) - budget).toFixed(2)} NIM above the ${budget} NIM budget — accepting this will ask the client to fund the difference.`
                : `Up to the ${budget} NIM already in escrow, or ask for more if the job is worth it.`}
            </p>
          </div>
          <div>
            <label className="text-[13px] font-medium text-secondary-foreground">
              Delivery (days)
            </label>
            <Input
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className="mt-2"
              required
            />
            <p className="mt-1 text-[12px] text-subtle-foreground">
              Client asked for {opportunity.timelineDays ?? '—'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button type="submit" disabled={saving}>
            {saving ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />}
            {saving ? 'Sending' : existing ? 'Update proposal' : 'Send proposal'}
          </Button>
          {existing && (
            <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          )}
        </div>
      </form>
    </Card>
  )
}
