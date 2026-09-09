'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Compass,
  Sparkles,
  ShieldCheck,
  Star,
  Scale,
  Wallet,
  ArrowRight,
  Lock,
  CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/page'
import { useWalletLogin } from '@/hooks/useWalletLogin'

const FEATURES = [
  {
    icon: Compass,
    title: 'Funded-only opportunity board',
    body: 'Clients post structured briefs — category, scope, deliverables, budget, timeline — and commit the budget to escrow before the posting goes public. Nothing on the board is speculative.',
  },
  {
    icon: ShieldCheck,
    title: 'Native HTLC escrow',
    body: "Funds lock in Nimiq's own hashed timelock contracts. Not a custom smart contract, not a company account. Release on approval, refund on timeout.",
  },
  {
    icon: Star,
    title: 'Portable reputation',
    body: 'Every settled deal writes to a trust score and completion rate, so the counterparty you have never met still arrives with a track record.',
  },
  {
    icon: Scale,
    title: 'AI dispute mediation',
    body: 'When a deal stalls, the mediator reads the submitted work against the original requirements, the timeline, and the full message history, then issues a reasoned verdict.',
  },
]

const STEPS = [
  ['Connect', 'Sign in with your Nimiq Pay wallet. No password, no signup form.'],
  ['Post', 'Fill in the brief and commit the budget. Only funded work reaches the board.'],
  ['Select', 'Freelancers propose. Accepting one creates the HTLC and opens a private chat.'],
  ['Settle', 'Approve to release the escrow, or open a dispute for AI mediation.'],
]

export default function Home() {
  const { connectWallet, loading, error } = useWalletLogin()
  const [signedIn, setSignedIn] = useState(false)
  // A returning wallet that never picked a side resumes at /onboarding.
  const [resumeHref, setResumeHref] = useState('/dashboard')

  useEffect(() => {
    fetch('/api/auth/session', { credentials: 'include' })
      .then(async (res) => {
        setSignedIn(res.ok)
        if (!res.ok) return
        const { user } = await res.json()
        setResumeHref(user?.role ? '/dashboard' : '/onboarding')
      })
      .catch(() => setSignedIn(false))
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-content items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-accent">
              <Lock className="h-3.5 w-3.5 text-accent-foreground" strokeWidth={2.5} />
            </div>
            <span className="text-[15px] font-medium tracking-body">NimTrust</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-[13px] text-muted-foreground sm:block">
              Nimiq Pay Mini App
            </span>
            {signedIn ? (
              <Link href={resumeHref}>
                <Button size="sm">Open dashboard</Button>
              </Link>
            ) : (
              <Button size="sm" onClick={connectWallet} disabled={loading}>
                {loading ? <Spinner className="h-3.5 w-3.5" /> : null}
                {loading ? 'Connecting' : 'Connect wallet'}
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Hero — left-aligned oversized headline, product preview floating on gradient */}
      <section className="relative overflow-hidden border-b border-border">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(60% 50% at 15% 0%, rgba(228,242,34,0.07) 0%, transparent 70%)',
          }}
        />
        <div className="relative mx-auto max-w-content px-6 pb-24 pt-20 sm:pt-28">
          <Badge tone="neutral" className="mb-6">
            <Sparkles className="h-3 w-3" />
            Escrow-backed on Nimiq
          </Badge>
          <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <h1 className="max-w-2xl text-[44px] font-medium leading-[1.05] tracking-display sm:text-[64px]">
                Trust, for deals
                <br />
                between strangers.
              </h1>
              <p className="mt-6 max-w-xl text-body-lg font-normal text-muted-foreground">
                NimTrust is a marketplace where the budget is locked in a Nimiq HTLC before the
                work is even advertised — and an AI mediator settles it if the two of you cannot.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                {signedIn ? (
                  <Link href={resumeHref}>
                    <Button size="lg">
                      Open dashboard
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                ) : (
                  <Button size="lg" onClick={connectWallet} disabled={loading}>
                    {loading ? <Spinner className="h-4 w-4" /> : <Wallet className="h-4 w-4" />}
                    {loading ? 'Connecting' : 'Connect wallet'}
                    {!loading && <ArrowRight className="h-4 w-4" />}
                  </Button>
                )}
                <a
                  href="#how"
                  className="text-[14px] text-muted-foreground transition-colors hover:text-foreground"
                >
                  See how it works →
                </a>
              </div>
              {error && <p className="mt-4 text-[13px] text-destructive">{error}</p>}
            </div>

            {/* Product preview — real UI, framed, per the reference's screenshot-first language */}
            <div className="relative">
              <div className="rounded-lg bg-card shadow-hairline shadow-float">
                <div className="flex items-center gap-1.5 border-b border-border px-4 py-3">
                  <div className="h-2 w-2 rounded-full bg-white/10" />
                  <div className="h-2 w-2 rounded-full bg-white/10" />
                  <div className="h-2 w-2 rounded-full bg-white/10" />
                  <span className="ml-2 font-mono text-[11px] text-subtle-foreground">
                    NMT-104
                  </span>
                </div>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[15px] font-medium">Landing page redesign</p>
                      <p className="mt-1 text-[13px] text-muted-foreground">
                        with 0xF4…9c2b
                      </p>
                    </div>
                    <Badge tone="info">Active</Badge>
                  </div>

                  <div className="mt-5 flex items-center justify-between rounded-md bg-white/[0.03] px-3.5 py-3">
                    <div className="flex items-center gap-2">
                      <Lock className="h-3.5 w-3.5 text-accent" />
                      <span className="text-[13px] text-secondary-foreground">Locked in escrow</span>
                    </div>
                    <span className="font-mono text-[13px] tabular-nums text-foreground">
                      500.00 NIM
                    </span>
                  </div>

                  <div className="mt-5 space-y-3">
                    {[
                      ['Wireframes approved', true],
                      ['Design system delivered', true],
                      ['Final handoff', false],
                    ].map(([label, done]) => (
                      <div key={label as string} className="flex items-center gap-2.5">
                        <CheckCircle2
                          className={`h-4 w-4 shrink-0 ${done ? 'text-success' : 'text-subtle-foreground'}`}
                        />
                        <span
                          className={`text-[13px] ${done ? 'text-secondary-foreground' : 'text-subtle-foreground'}`}
                        >
                          {label as string}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 border-t border-border pt-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] text-muted-foreground">Counterparty trust</span>
                      <span className="font-mono text-[12px] tabular-nums text-success">92 / 100</span>
                    </div>
                    <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
                      <div className="h-full w-[92%] rounded-full bg-success" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-content px-6 py-24">
          <h2 className="max-w-xl text-heading-sm font-medium tracking-heading">
            Everything a handshake deal was missing.
          </h2>
          <div className="mt-14 grid gap-px overflow-hidden rounded-lg bg-border sm:grid-cols-2">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-card p-6">
                <f.icon className="h-4 w-4 text-accent" />
                <h3 className="mt-4 text-[15px] font-medium tracking-body">{f.title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-b border-border">
        <div className="mx-auto max-w-content px-6 py-24">
          <h2 className="text-heading-sm font-medium tracking-heading">How it works</h2>
          <div className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(([title, body], i) => (
              <div key={title}>
                <span className="font-mono text-[12px] text-subtle-foreground">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="mt-3 text-[15px] font-medium tracking-body">{title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-content px-6 py-24">
          <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
            <h2 className="max-w-lg text-heading-sm font-medium tracking-heading">
              Make your next deal trustless.
            </h2>
            {signedIn ? (
              <Link href={resumeHref}>
                <Button size="lg">Open dashboard</Button>
              </Link>
            ) : (
              <Button size="lg" onClick={connectWallet} disabled={loading}>
                {loading ? <Spinner className="h-4 w-4" /> : <Wallet className="h-4 w-4" />}
                {loading ? 'Connecting' : 'Connect wallet'}
              </Button>
            )}
          </div>
        </div>
      </section>

      <footer>
        <div className="mx-auto flex max-w-content flex-col gap-2 px-6 py-10 text-[13px] text-subtle-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>NimTrust — AI-powered trust layer for P2P commerce on Nimiq</span>
          <span className="font-mono">Nimiq Mini Apps</span>
        </div>
      </footer>
    </div>
  )
}
