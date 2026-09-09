'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  Paperclip,
  Clock,
  Wallet,
  User,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { PageLoading } from '@/components/ui/page'
import EscrowPanel from '@/components/opportunity/EscrowPanel'
import ProposalPanel from '@/components/opportunity/ProposalPanel'
import WorkPanel from '@/components/opportunity/WorkPanel'
import ChatPanel from '@/components/opportunity/ChatPanel'
import type { OpportunityDetail } from '@/components/opportunity/types'
import { categoryLabel, isEngaged, parseAttachments } from '@/lib/opportunities'
import { formatDate, parseJsonArray, shortAddress } from '@/lib/utils'

// One page for the whole life of an opportunity. What it shows is decided by
// who is reading and how far along the deal is: a stranger sees the brief and a
// way to pitch; the client sees the proposals; once one is accepted, both sides
// see the escrow, the work, and their private thread.
export default function OpportunityDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [opportunity, setOpportunity] = useState<OpportunityDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const res = await fetch(`/api/opportunities/${id}`, { credentials: 'include' })
    if (!res.ok) {
      if (res.status === 401) router.push('/')
      else setError((await res.json().catch(() => null))?.error ?? 'Could not load this opportunity')
      return
    }
    setOpportunity(await res.json())
  }, [id, router])

  useEffect(() => {
    load().finally(() => setLoading(false))
  }, [load])

  // Arriving straight from the posting form, where the next step is funding.
  // Read from location rather than useSearchParams so the page needs no
  // Suspense boundary for a hint this small.
  useEffect(() => {
    if (!opportunity || opportunity.status !== 'draft' || !opportunity.viewer.isClient) return
    if (new URLSearchParams(window.location.search).get('fund') !== '1') return
    setNotice(
      'Saved as a draft. Commit the budget in the escrow panel to publish it — freelancers only see funded work.',
    )
  }, [opportunity])

  if (loading) return <PageLoading />
  if (!opportunity) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
        <AlertTriangle className="h-5 w-5 text-destructive" />
        <p className="text-[15px] font-medium">{error || 'Opportunity not found'}</p>
        <Link href="/dashboard/opportunities" className="text-[13px] text-muted-foreground hover:text-foreground">
          Back to the board
        </Link>
      </div>
    )
  }

  const deliverables = parseJsonArray(opportunity.deliverables)
  const attachments = parseAttachments(opportunity.attachments)
  const budget = Number(opportunity.budgetNIM ?? opportunity.amountNIM)
  const { isParty, isClient } = opportunity.viewer
  const engaged = isEngaged(opportunity.status) || opportunity.status === 'completed'

  return (
    <>
      <Link
        href="/dashboard/opportunities"
        className="mb-6 flex w-fit items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Opportunities
      </Link>

      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={opportunity.status} tone={opportunity.status === 'open' ? 'accent' : undefined} />
          <Badge>{categoryLabel(opportunity.category)}</Badge>
          {opportunity.serviceType && <Badge>{opportunity.serviceType}</Badge>}
        </div>
        <h1 className="mt-3 text-heading-sm font-medium leading-tight tracking-heading">
          {opportunity.title}
        </h1>
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-subtle-foreground">
          <span className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" />
            {opportunity.buyer.displayName ?? shortAddress(opportunity.buyer.address)}
          </span>
          <span>·</span>
          <span>Posted {formatDate(opportunity.publishedAt ?? opportunity.createdAt)}</span>
        </p>
      </div>

      <Card>
        <div className="grid grid-cols-2 gap-px bg-border lg:grid-cols-4">
          {[
            ['Budget', `${budget.toFixed(0)} NIM`],
            ['Timeline', opportunity.timelineDays ? `${opportunity.timelineDays} days` : '—'],
            [
              engaged ? 'Deadline' : 'Proposals',
              engaged
                ? new Date(opportunity.deadline).toLocaleDateString()
                : String(opportunity.proposalCount),
            ],
            [
              'Freelancer',
              opportunity.seller?.displayName ?? (engaged ? 'Assigned' : 'Not selected'),
            ],
          ].map(([label, value]) => (
            <div key={label} className="bg-card p-5">
              <p className="text-[13px] text-muted-foreground">{label}</p>
              <p className="mt-1.5 truncate text-[16px] font-medium tracking-body">{value}</p>
            </div>
          ))}
        </div>
      </Card>

      {notice && (
        <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-accent/25 bg-accent/[0.06] p-4">
          <CheckCircle2 className="mt-px h-4 w-4 shrink-0 text-accent" />
          <p className="text-[13px] leading-relaxed text-secondary-foreground">{notice}</p>
        </div>
      )}
      {error && (
        <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-destructive/25 bg-destructive/[0.06] p-4">
          <AlertTriangle className="mt-px h-4 w-4 shrink-0 text-destructive" />
          <p className="text-[13px] leading-relaxed text-secondary-foreground">{error}</p>
        </div>
      )}

      <div className="mt-3 grid gap-3 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-3">
          <Card>
            <div className="border-b border-border px-5 py-3.5">
              <span className="text-[15px] font-medium tracking-body">The brief</span>
            </div>
            <div className="space-y-6 p-5">
              <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-muted-foreground">
                {opportunity.description}
              </p>

              <div>
                <p className="mb-2.5 text-[13px] font-medium text-secondary-foreground">
                  Deliverables
                </p>
                <ul className="space-y-1.5">
                  {deliverables.map((d, i) => (
                    <li key={i} className="flex gap-2.5 text-[14px] text-muted-foreground">
                      <span className="font-mono text-[12px] text-subtle-foreground">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      {d}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="mb-2.5 text-[13px] font-medium text-secondary-foreground">
                  Attachments
                </p>
                {attachments.length === 0 ? (
                  <p className="text-[13px] text-subtle-foreground">None supplied.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {attachments.map((a, i) => (
                      <li key={i}>
                        <a
                          href={a.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-[14px] text-accent hover:underline"
                        >
                          <Paperclip className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{a.label}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="grid gap-6 border-t border-border pt-5 sm:grid-cols-2">
                <div>
                  <p className="mb-1.5 text-[13px] font-medium text-secondary-foreground">
                    On completion
                  </p>
                  <p className="text-[13px] leading-relaxed text-muted-foreground">
                    {opportunity.completionTerms}
                  </p>
                </div>
                <div>
                  <p className="mb-1.5 text-[13px] font-medium text-secondary-foreground">
                    On failure
                  </p>
                  <p className="text-[13px] leading-relaxed text-muted-foreground">
                    {opportunity.refundTerms}
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Proposals matter until someone is chosen; after that the work does. */}
          {engaged && isParty ? (
            <WorkPanel
              opportunity={opportunity}
              onChanged={load}
              onNotice={setNotice}
              onError={setError}
            />
          ) : (
            <ProposalPanel
              opportunity={opportunity}
              onChanged={load}
              onNotice={setNotice}
              onError={setError}
            />
          )}

          {isParty && <ChatPanel opportunity={opportunity} />}
        </div>

        <div className="space-y-3">
          <EscrowPanel
            opportunity={opportunity}
            onChanged={load}
            onNotice={setNotice}
            onError={setError}
          />

          {/* Once the work is under way the client still needs a way back to the
              proposal they accepted — it is part of the record. */}
          {engaged && isClient && opportunity.proposals.length > 0 && (
            <ProposalPanel
              opportunity={opportunity}
              onChanged={load}
              onNotice={setNotice}
              onError={setError}
            />
          )}

          <Card>
            <div className="space-y-3 p-5">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-[13px] text-muted-foreground">
                  <Wallet className="h-3.5 w-3.5" />
                  Escrow amount
                </span>
                <span className="font-mono text-[13px] tabular-nums text-secondary-foreground">
                  {Number(opportunity.amountNIM).toFixed(2)} NIM
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-[13px] text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  {engaged ? 'Due' : 'Timeline'}
                </span>
                <span className="text-[13px] text-secondary-foreground">
                  {engaged
                    ? new Date(opportunity.deadline).toLocaleDateString()
                    : `${opportunity.timelineDays ?? '—'} days`}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-muted-foreground">Status</span>
                <StatusBadge
                  status={opportunity.status}
                  tone={opportunity.status === 'open' ? 'accent' : undefined}
                />
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}
