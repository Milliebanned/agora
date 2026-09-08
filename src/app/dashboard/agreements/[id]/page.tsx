'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Send,
  Scale,
  Circle,
} from 'lucide-react'
import { formatDate, parseJsonArray, shortAddress, cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { Input, Textarea } from '@/components/ui/input'
import { PageLoading, Spinner } from '@/components/ui/page'

interface Agreement {
  id: string
  title: string
  description: string
  status: string
  amountNIM: number
  deadline: string
  htlcAddress?: string
  htlcHashRoot?: string
  riskFlags: string
  createdAt: string
  buyer: { id: string; displayName: string; address: string }
  seller?: { id: string; displayName: string; address: string }
  milestones: Array<{
    id: string
    title: string
    status: string
    deliverable?: string
    createdAt: string
    submittedAt?: string
    approvedAt?: string
  }>
  escrowTransactions: Array<{ type: string; status: string; txHash?: string; createdAt: string }>
  messages: Array<{
    id: string
    type: string
    content: string
    createdAt: string
    sender?: { displayName: string }
  }>
}

export default function AgreementDetailPage() {
  const router = useRouter()
  const params = useParams()
  const agreementId = params.id as string

  const [agreement, setAgreement] = useState<Agreement | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [funding, setFunding] = useState(false)
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [showDisputeForm, setShowDisputeForm] = useState(false)
  const [disputeReason, setDisputeReason] = useState('')
  const [openingDispute, setOpeningDispute] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const refresh = async () => {
    const res = await fetch(`/api/agreements/${agreementId}`, { credentials: 'include' })
    if (res.ok) setAgreement(await res.json())
  }

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/agreements/${agreementId}`, { credentials: 'include' })
        if (!res.ok) {
          router.push('/')
          return
        }
        setAgreement(await res.json())
        const sessionRes = await fetch('/api/auth/session', { credentials: 'include' })
        if (sessionRes.ok) setUser((await sessionRes.json()).user)
      } catch {
        setError('Failed to load agreement')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [agreementId, router])

  const handleFundEscrow = async () => {
    setFunding(true)
    setError('')
    setNotice('')
    try {
      const res = await fetch(`/api/agreements/${agreementId}/fund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        credentials: 'include',
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to prepare escrow')
      const { htlcData } = await res.json()
      setNotice(
        `Escrow prepared — hash root ${String(htlcData?.hash_root ?? '').substring(0, 16)}…. In Nimiq Pay, sign the HTLC transaction to lock the funds.`,
      )
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setFunding(false)
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim()) return
    setSending(true)
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agreementId, content: newMessage }),
        credentials: 'include',
      })
      if (res.ok && agreement) {
        const msg = await res.json()
        setAgreement({ ...agreement, messages: [...agreement.messages, msg] })
        setNewMessage('')
        requestAnimationFrame(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }))
      }
    } catch {
      setError('Failed to send message')
    } finally {
      setSending(false)
    }
  }

  const handleOpenDispute = async () => {
    if (!disputeReason.trim()) {
      setError('Add a reason before opening the dispute')
      return
    }
    setOpeningDispute(true)
    setError('')
    try {
      const res = await fetch('/api/disputes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agreementId, reason: disputeReason }),
        credentials: 'include',
      })
      if (!res.ok) throw new Error('Failed to open dispute')
      router.push('/dashboard/disputes')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open dispute')
      setOpeningDispute(false)
      setShowDisputeForm(false)
    }
  }

  const handleApproveMilestone = async (milestoneId: string) => {
    setError('')
    try {
      const res = await fetch(`/api/agreements/${agreementId}/milestones`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ milestoneId, status: 'approved' }),
        credentials: 'include',
      })
      if (!res.ok) throw new Error('Failed to approve milestone')
      setNotice('Milestone approved — funds will be released to the seller.')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve milestone')
    }
  }

  if (loading) return <PageLoading />
  if (!agreement) return <PageLoading label="Agreement not found" />

  const isBuyer = user?.id === agreement.buyer.id
  const riskFlags = parseJsonArray(agreement.riskFlags)
  const funded = Boolean(agreement.htlcAddress)

  return (
    <>
      <Link
        href="/dashboard/agreements"
        className="mb-6 flex w-fit items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All agreements
      </Link>

      <div className="mb-6 flex items-start justify-between gap-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <StatusBadge status={agreement.status} />
            <span className="font-mono text-[12px] text-subtle-foreground">
              {agreement.id.slice(0, 8)}
            </span>
          </div>
          <h1 className="mt-2.5 text-heading-sm font-medium tracking-heading">{agreement.title}</h1>
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-muted-foreground">
            {agreement.description}
          </p>
        </div>
      </div>

      <Card>
        <div className="grid grid-cols-2 gap-px bg-border lg:grid-cols-4">
          {[
            ['Amount', `${Number(agreement.amountNIM).toFixed(2)} NIM`],
            ['Deadline', new Date(agreement.deadline).toLocaleDateString()],
            ['Buyer', agreement.buyer.displayName],
            ['Seller', agreement.seller?.displayName ?? 'Awaiting'],
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
          {/* Escrow */}
          <Card>
            <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <Lock className="h-4 w-4 text-accent" />
                <span className="text-[15px] font-medium tracking-body">Escrow</span>
              </div>
              {funded && <Badge tone="success">Funded</Badge>}
            </div>
            <div className="p-5">
              {funded ? (
                <>
                  <div className="flex items-center justify-between rounded-md bg-white/[0.03] px-4 py-3.5">
                    <span className="text-[13px] text-secondary-foreground">Locked in HTLC</span>
                    <span className="font-mono text-[14px] tabular-nums text-foreground">
                      {Number(agreement.amountNIM).toFixed(2)} NIM
                    </span>
                  </div>
                  {agreement.htlcAddress && (
                    <p className="mt-3 font-mono text-[12px] text-subtle-foreground">
                      {shortAddress(agreement.htlcAddress, 10)}
                    </p>
                  )}
                  {agreement.escrowTransactions.length > 0 && (
                    <div className="mt-4 space-y-2 border-t border-border pt-4">
                      {agreement.escrowTransactions.map((tx, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <span className="text-[13px] capitalize text-secondary-foreground">
                            {tx.type} · {tx.status}
                          </span>
                          <span className="text-[12px] text-subtle-foreground">
                            {formatDate(tx.createdAt)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : isBuyer ? (
                <>
                  <p className="mb-4 text-[14px] leading-relaxed text-muted-foreground">
                    Lock {Number(agreement.amountNIM).toFixed(2)} NIM in a Nimiq hashed timelock
                    contract. The seller can verify the funds exist but cannot touch them until you
                    approve delivery.
                  </p>
                  <Button onClick={handleFundEscrow} disabled={funding}>
                    {funding ? <Spinner className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                    {funding ? 'Preparing' : 'Fund escrow'}
                  </Button>
                </>
              ) : (
                <p className="text-[14px] text-muted-foreground">
                  Waiting for the buyer to fund the escrow.
                </p>
              )}
            </div>
          </Card>

          {/* Milestones */}
          <Card>
            <div className="border-b border-border px-5 py-3.5">
              <span className="text-[15px] font-medium tracking-body">Milestones</span>
            </div>
            {agreement.milestones.length === 0 ? (
              <p className="px-5 py-8 text-center text-[14px] text-muted-foreground">
                No milestones yet
              </p>
            ) : (
              <div>
                {agreement.milestones.map((ms, i) => (
                  <div
                    key={ms.id}
                    className={cn('px-5 py-4', i > 0 && 'border-t border-border')}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 items-start gap-3">
                        {ms.status === 'approved' ? (
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                        ) : (
                          <Circle className="mt-0.5 h-4 w-4 shrink-0 text-subtle-foreground" />
                        )}
                        <div className="min-w-0">
                          <p className="text-[14px] text-secondary-foreground">{ms.title}</p>
                          <p className="mt-1 text-[12px] text-subtle-foreground">
                            {formatDate(ms.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2.5">
                        <StatusBadge status={ms.status} />
                        {isBuyer && ms.status === 'submitted' && (
                          <Button size="sm" onClick={() => handleApproveMilestone(ms.id)}>
                            Approve
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Messages */}
          <Card>
            <div className="border-b border-border px-5 py-3.5">
              <span className="text-[15px] font-medium tracking-body">Messages</span>
            </div>
            <div className="max-h-80 min-h-[120px] space-y-4 overflow-y-auto p-5">
              {agreement.messages.length === 0 ? (
                <p className="py-6 text-center text-[14px] text-muted-foreground">
                  No messages yet
                </p>
              ) : (
                agreement.messages.slice(-20).map((msg) =>
                  msg.type === 'system' ? (
                    <p key={msg.id} className="text-center text-[12px] text-subtle-foreground">
                      {msg.content}
                    </p>
                  ) : (
                    <div key={msg.id}>
                      <div className="flex items-baseline gap-2">
                        <span className="text-[13px] font-medium text-secondary-foreground">
                          {msg.sender?.displayName ?? 'Unknown'}
                        </span>
                        <span className="text-[11px] text-subtle-foreground">
                          {formatDate(msg.createdAt)}
                        </span>
                      </div>
                      <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">
                        {msg.content}
                      </p>
                    </div>
                  ),
                )
              )}
              <div ref={messagesEndRef} />
            </div>
            <form
              onSubmit={handleSendMessage}
              className="flex gap-2 border-t border-border px-5 py-4"
            >
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Write a message…"
                disabled={sending}
                className="py-2"
              />
              <Button type="submit" disabled={sending || !newMessage.trim()}>
                {sending ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-3">
          {riskFlags.length > 0 && (
            <Card>
              <div className="p-5">
                <p className="mb-3 flex items-center gap-2 text-[13px] font-medium text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Risk flags
                </p>
                <ul className="space-y-2">
                  {riskFlags.map((flag, i) => (
                    <li key={i} className="text-[13px] leading-relaxed text-muted-foreground">
                      {flag}
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
          )}

          <Card>
            <div className="space-y-3 p-5">
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-muted-foreground">Created</span>
                <span className="text-[13px] text-secondary-foreground">
                  {new Date(agreement.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-muted-foreground">Status</span>
                <StatusBadge status={agreement.status} />
              </div>
            </div>
          </Card>

          <Card>
            <div className="p-5">
              {!showDisputeForm ? (
                <>
                  <p className="mb-3 text-[13px] leading-relaxed text-muted-foreground">
                    Something wrong with this deal? Open a dispute and Claude will review the case.
                  </p>
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() => setShowDisputeForm(true)}
                  >
                    <Scale className="h-4 w-4" />
                    Open dispute
                  </Button>
                </>
              ) : (
                <div className="space-y-3">
                  <p className="text-[13px] font-medium text-secondary-foreground">
                    Why are you opening a dispute?
                  </p>
                  <Textarea
                    value={disputeReason}
                    onChange={(e) => setDisputeReason(e.target.value)}
                    rows={4}
                    placeholder="Explain what went wrong…"
                  />
                  <div className="flex gap-2">
                    <Button onClick={handleOpenDispute} disabled={openingDispute} className="flex-1">
                      {openingDispute ? <Spinner className="h-4 w-4" /> : null}
                      {openingDispute ? 'Opening' : 'Submit'}
                    </Button>
                    <Button variant="secondary" onClick={() => setShowDisputeForm(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}
