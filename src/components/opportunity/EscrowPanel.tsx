'use client'

import { useState } from 'react'
import { Lock, ShieldCheck, Wallet, Coins } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/page'
import { ESCROW_STAGE_COPY, escrowStage } from '@/lib/opportunities'
import { formatDate, shortAddress } from '@/lib/utils'
import { sendBasicTransaction } from '@/lib/nimiq'
import type { OpportunityDetail } from './types'

// The escrow panel says exactly where the money is, and never claims the chain
// has done something it has not been told the chain did.
export default function EscrowPanel({
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

  const stage = escrowStage(opportunity)
  const copy = ESCROW_STAGE_COPY[stage]
  const amount = Number(opportunity.amountNIM)
  const { isClient, isFreelancer } = opportunity.viewer
  const paidOut = opportunity.escrowTransactions.some(
    (tx) => tx.type === 'claim' && tx.status === 'confirmed',
  )
  // A payment the client has already made for this posting, whether or not the
  // chain has caught up. While this exists the pay button must not: the money
  // is gone and offering to send it again is the bug that costs them twice.
  const fundAttempt = opportunity.escrowTransactions.find((tx) => tx.type === 'fund')

  const json = async (url: string, init?: RequestInit) => {
    const res = await fetch(url, { credentials: 'include', ...init })
    const body = await res.json().catch(() => null)
    if (!res.ok) {
      throw new Error(
        body?.detail ? `${body.error} — ${body.detail}` : body?.error ?? `Request failed (${res.status})`,
      )
    }
    return body
  }

  // Publishing costs real money, and that is the point: the budget leaves the
  // client's wallet here, so nothing reaches the board on a promise. Three
  // steps — ask the server where to pay, have Nimiq Pay send it, then let the
  // server confirm it against the chain before the posting goes live.
  const fund = async () => {
    setBusy('fund')
    onError('')
    try {
      const destination = await json(`/api/opportunities/${opportunity.id}/escrow`)

      const transfer = await sendBasicTransaction({
        recipient: destination.escrowAddress,
        value: destination.amountLuna,
      })

      if (!transfer.ok) {
        onError(transfer.reason ?? 'The wallet did not send the payment.')
        return
      }

      // Nimiq Pay returns the signed transaction itself rather than a hash.
      // The server reads the payment out of it — sender, recipient, amount and
      // hash — so a payment can be recorded before any node has seen it.
      const result = await json(`/api/opportunities/${opportunity.id}/fund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serialized: transfer.serialized ?? null,
          txHash: transfer.txHash ?? null,
        }),
      })

      onNotice(result.message)
      // Even when it has not confirmed yet, the attempt is now on the record,
      // so re-reading the deal is what replaces the pay button with a status.
      await onChanged()
    } catch (err) {
      // A payment that went through but failed to verify is the case that must
      // never read as "nothing happened" — the client's NIM is already gone.
      onError(
        err instanceof Error
          ? `${err.message} If your wallet shows the payment as sent, do not send it again — tap "Check payment status" in a minute.`
          : 'Funding failed',
      )
    } finally {
      setBusy(null)
    }
  }

  // Resume a payment already made. Sends no money: it asks the server to look
  // again at the transaction it has on file, and publishes if the chain has
  // caught up since.
  const checkPayment = async () => {
    setBusy('check')
    onError('')
    try {
      const result = await json(`/api/opportunities/${opportunity.id}/fund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      onNotice(result.message)
      await onChanged()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not check the payment')
    } finally {
      setBusy(null)
    }
  }

  // The rescue hatch for a posting funded before any of this was recorded: the
  // client paid, the app lost it, and the only evidence is the chain. Sends no
  // money either — it looks for an unclaimed payment from this wallet into the
  // escrow account and attaches it to this posting.
  const recoverPayment = async () => {
    setBusy('recover')
    onError('')
    try {
      const result = await json(`/api/opportunities/${opportunity.id}/fund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recover: true }),
      })
      onNotice(result.message)
      await onChanged()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not find a payment to recover')
    } finally {
      setBusy(null)
    }
  }

  // The client approved, so the money is the freelancer's to take. The payout
  // is signed by the escrow wallet server-side; this only asks for it.
  const claim = async () => {
    setBusy('claim')
    onError('')
    try {
      const result = await json(`/api/opportunities/${opportunity.id}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      onNotice(result.message)
      await onChanged()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'The claim failed')
    } finally {
      setBusy(null)
    }
  }

  const tone =
    stage === 'held' || stage === 'assigned'
      ? 'accent'
      : stage === 'released'
        ? 'success'
        : 'neutral'

  return (
    <Card>
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <Lock className="h-4 w-4 text-accent" />
          <span className="text-[15px] font-medium tracking-body">Escrow</span>
        </div>
        <Badge tone={tone}>{copy.label}</Badge>
      </div>

      <div className="p-5">
        <div className="flex items-center justify-between rounded-md bg-white/[0.03] px-4 py-3.5">
          <span className="text-[13px] text-secondary-foreground">
            {stage === 'unfunded' ? 'Budget to pay' : 'Amount'}
          </span>
          <span className="font-mono text-[15px] tabular-nums text-foreground">
            {amount.toFixed(2)} NIM
          </span>
        </div>

        <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">{copy.detail}</p>

        {opportunity.htlcTimeout ? (
          <p className="mt-2 text-[12px] text-subtle-foreground">
            Refundable to the client from block {opportunity.htlcTimeout.toLocaleString()}.
          </p>
        ) : null}

        {/* A payment is already on the record for this posting. It has not
            confirmed yet, so the only honest actions are to wait or to look
            again — never to pay. */}
        {isClient && stage === 'unfunded' && fundAttempt && (
          <>
            <div className="mt-4 rounded-md border border-accent/25 bg-accent/[0.06] p-4">
              <p className="text-[13px] font-medium text-accent">Payment sent, awaiting confirmation</p>
              <p className="mt-1.5 text-[12px] leading-relaxed text-secondary-foreground">
                {amount.toFixed(2)} NIM has left your wallet and is recorded against this posting.
                It publishes itself as soon as the network confirms it.{' '}
                <span className="font-medium">Do not pay again.</span>
              </p>
              {fundAttempt.txHash && (
                <p className="mt-2 font-mono text-[11px] text-muted-foreground">
                  {shortAddress(fundAttempt.txHash, 8)}
                </p>
              )}
            </div>
            <Button
              variant="secondary"
              onClick={checkPayment}
              disabled={busy !== null}
              className="mt-3 w-full"
            >
              {busy === 'check' ? <Spinner className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
              {busy === 'check' ? 'Checking the network' : 'Check payment status'}
            </Button>
          </>
        )}

        {isClient && stage === 'unfunded' && !fundAttempt && (
          <>
            <Button onClick={fund} disabled={busy !== null} className="mt-4 w-full">
              {busy === 'fund' ? <Spinner className="h-4 w-4" /> : <Wallet className="h-4 w-4" />}
              {busy === 'fund' ? 'Waiting for Nimiq Pay' : `Pay ${amount.toFixed(2)} NIM & publish`}
            </Button>
            <p className="mt-2 text-[12px] leading-relaxed text-subtle-foreground">
              Nimiq Pay will ask you to confirm. This debits your wallet for real — the posting only
              goes live once the payment is confirmed on-chain.
            </p>
            <button
              type="button"
              onClick={recoverPayment}
              disabled={busy !== null}
              className="mt-3 w-full text-[12px] text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground disabled:opacity-50"
            >
              {busy === 'recover'
                ? 'Looking for your payment…'
                : 'I already paid for this posting — find my payment'}
            </button>
          </>
        )}

        {isFreelancer && opportunity.status === 'completed' && !paidOut && (
          <>
            <Button onClick={claim} disabled={busy !== null} className="mt-4 w-full">
              {busy === 'claim' ? <Spinner className="h-4 w-4" /> : <Coins className="h-4 w-4" />}
              {busy === 'claim' ? 'Sending' : `Claim ${amount.toFixed(2)} NIM`}
            </Button>
            <p className="mt-2 text-[12px] leading-relaxed text-subtle-foreground">
              Paid to the wallet you signed in with. Tapping twice cannot pay you twice.
            </p>
          </>
        )}

        {paidOut && (
          <p className="mt-4 flex items-center gap-2 text-[13px] text-success">
            <ShieldCheck className="h-4 w-4" />
            Paid out on-chain.
          </p>
        )}

        {opportunity.escrowTransactions.length > 0 && (
          <div className="mt-4 space-y-2 border-t border-border pt-4">
            {opportunity.escrowTransactions.map((tx, i) => (
              <div key={i} className="flex items-center justify-between gap-3">
                <span className="text-[13px] capitalize text-secondary-foreground">
                  {tx.type} · {tx.status}
                </span>
                <span className="flex items-center gap-2 text-[12px] text-subtle-foreground">
                  {tx.txHash && (
                    <span className="font-mono">{shortAddress(tx.txHash, 6)}</span>
                  )}
                  {formatDate(tx.createdAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}
