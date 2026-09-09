'use client'

import { useEffect, useRef, useState } from 'react'
import { Send, MessagesSquare, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/page'
import { formatDate, cn } from '@/lib/utils'
import type { MessageRow, OpportunityDetail } from './types'

// The private thread between the two parties. It only exists after a proposal
// is accepted, and nothing in it is ever deleted — the mediator reads it as
// evidence, which is worth saying out loud to both people using it.
export default function ChatPanel({ opportunity }: { opportunity: OpportunityDetail }) {
  const [messages, setMessages] = useState<MessageRow[]>(opportunity.messages)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  const engaged = Boolean(opportunity.sellerId)

  // Polling rather than a socket: the WebView suspends aggressively when the
  // phone locks, and a refetch on resume is more reliable than a reconnect.
  useEffect(() => {
    if (!engaged) return
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/messages?agreementId=${opportunity.id}`, {
          credentials: 'include',
        })
        if (res.ok) setMessages(await res.json())
      } catch {
        // A dropped poll is not worth surfacing; the next one will catch up.
      }
    }, 10000)
    return () => clearInterval(id)
  }, [engaged, opportunity.id])

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' })
  }, [messages.length])

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!draft.trim()) return
    setSending(true)
    setError('')
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ agreementId: opportunity.id, content: draft }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.error ?? 'Could not send')
      setMessages((prev) => [...prev, body])
      setDraft('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send')
    } finally {
      setSending(false)
    }
  }

  if (!engaged) {
    return (
      <Card>
        <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
          <MessagesSquare className="h-5 w-5 text-subtle-foreground" />
          <p className="text-[14px] font-medium text-secondary-foreground">Chat opens on selection</p>
          <p className="max-w-sm text-[13px] leading-relaxed text-muted-foreground">
            Until a proposal is accepted, the proposal itself is the conversation. That keeps the
            record of who offered what clean enough to hand to a mediator.
          </p>
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <span className="text-[15px] font-medium tracking-body">Private chat</span>
        <span className="flex items-center gap-1.5 text-[12px] text-subtle-foreground">
          <ShieldAlert className="h-3.5 w-3.5" />
          Kept as dispute evidence
        </span>
      </div>

      <div className="max-h-[420px] min-h-[160px] space-y-4 overflow-y-auto p-5">
        {messages.length === 0 ? (
          <p className="py-6 text-center text-[14px] text-muted-foreground">
            No messages yet. Agree the details here — it all counts as evidence.
          </p>
        ) : (
          messages.map((msg) =>
            msg.type === 'system' ? (
              <p
                key={msg.id}
                className="mx-auto max-w-md text-center text-[12px] leading-relaxed text-subtle-foreground"
              >
                {msg.content}
              </p>
            ) : (
              <div
                key={msg.id}
                className={cn(
                  'max-w-[85%] rounded-lg px-3.5 py-2.5',
                  msg.senderId === opportunity.viewer.id
                    ? 'ml-auto bg-accent/10'
                    : 'bg-white/[0.04]',
                )}
              >
                <div className="flex items-baseline gap-2">
                  <span className="text-[12px] font-medium text-secondary-foreground">
                    {msg.senderId === opportunity.viewer.id
                      ? 'You'
                      : msg.sender?.displayName ?? 'Counterparty'}
                  </span>
                  <span className="text-[11px] text-subtle-foreground">
                    {formatDate(msg.createdAt)}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-[14px] leading-relaxed text-foreground">
                  {msg.content}
                </p>
              </div>
            ),
          )
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={send} className="flex gap-2 border-t border-border px-5 py-4">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Write a message…"
          maxLength={1000}
          disabled={sending}
          className="py-2"
        />
        <Button type="submit" disabled={sending || !draft.trim()} aria-label="Send message">
          {sending ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
      {error && <p className="px-5 pb-4 text-[13px] text-destructive">{error}</p>}
    </Card>
  )
}
