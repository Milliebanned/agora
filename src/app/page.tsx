'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import {
  Compass,
  ShieldCheck,
  Star,
  Scale,
  Wallet,
  ArrowRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/page'
import { useWalletLogin } from '@/hooks/useWalletLogin'
import ThinkerScene from '@/components/decor/ThinkerScene'

const Globe = dynamic(() => import('@/components/globe/WireframeGlobe'), {
  ssr: false,
  loading: () => (
    <div
      className="h-full w-full"
      style={{
        background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.04), transparent 70%)',
      }}
    />
  ),
})

const FEATURES = [
  {
    icon: Compass,
    title: 'Funded-only opportunity board',
    body: 'Clients post a structured brief (category, scope, deliverables, budget, timeline) and commit the budget to escrow before the posting goes public. Nothing on the board is speculative.',
  },
  {
    icon: ShieldCheck,
    title: 'HTLC-backed escrow',
    body: "Funds lock in a Nimiq hashed timelock contract, not a company account. Approval lets the freelancer claim it; past the timeout, the client can claim a refund.",
  },
  {
    icon: Star,
    title: 'Portable reputation',
    body: 'Every settled deal writes to a trust score and completion rate, so the counterparty you have never met still arrives with a track record.',
  },
  {
    icon: Scale,
    title: 'AI dispute mediation',
    body: 'When a deal stalls, the mediator reads the submitted work against the original requirements, the delivery timeline, and the recent conversation, then issues a reasoned verdict.',
  },
]

// Outlined by default, and the outline only takes the brand colour on hover.
const NAV_LINK =
  'group flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-border px-2.5 py-1.5 font-mono text-[12px] tracking-[0.06em] text-muted-foreground transition-colors hover:border-[#3bb143] hover:text-foreground disabled:opacity-50'

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

  // A board link: a real link once there is a wallet to browse with, and the
  // connect prompt before that.
  const BoardLink = ({ label, href }: { label: string; href: string }) => {
    const inner = (
      <>
        <span className="text-subtle-foreground transition-colors group-hover:text-[#3bb143]">//</span>
        {label}
      </>
    )
    return signedIn ? (
      <Link href={href} className={NAV_LINK}>
        {inner}
      </Link>
    ) : (
      <button type="button" onClick={connectWallet} disabled={loading} className={NAV_LINK}>
        {inner}
      </button>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-content flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-3 md:h-14 md:flex-nowrap md:py-0">
          {/* Both boards are behind the wallet, so on a signed-out visit these
              ask for the wallet rather than leading somewhere that would just
              bounce them back. */}
          <nav className="order-3 -mx-6 flex w-full items-center gap-2 overflow-x-auto px-6 md:order-1 md:mx-0 md:w-auto md:flex-1 md:overflow-visible md:px-0">
            <BoardLink label="Find work" href="/dashboard/opportunities" />
            <BoardLink label="Find workers" href="/dashboard/workers" />
            <a
              href="https://www.agoraonnim.site/whitepaper.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className={NAV_LINK}
            >
              <span className="text-subtle-foreground transition-colors group-hover:text-[#3bb143]">//</span>
              Read docs
            </a>
          </nav>

          <div className="order-1 flex items-center gap-2 md:order-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" className="h-6 w-6" />
            <span className="text-[15px] font-medium tracking-body">Agora</span>
          </div>

          <div className="order-2 flex items-center gap-2 md:order-3 md:flex-1 md:justify-end">
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
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(60% 50% at 15% 0%, rgba(152,251,152,0.07) 0%, transparent 70%)',
          }}
        />
        <div className="relative mx-auto max-w-content px-6 pb-24 pt-20 sm:pt-28">
          <Badge tone="neutral" className="mb-6">
            Escrow-backed on Nimiq
          </Badge>
          <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="relative z-10">
              <h1 className="max-w-2xl text-[44px] font-bold uppercase leading-[1.05] tracking-tight sm:text-[64px]">
                Trust, between strangers.
              </h1>
              <p className="mt-6 max-w-xl text-body-lg font-normal text-muted-foreground">
                Hire, collaborate, and get paid with confidence.
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

            {/* Right visual — rotating wireframe globe. On mobile it sits behind the
                text/buttons as a background layer; from lg up it's back in the grid,
                bleeding past the section edge as before. */}
            <div className="pointer-events-none absolute inset-0 z-0 opacity-60 lg:pointer-events-auto lg:relative lg:inset-auto lg:z-auto lg:opacity-100 lg:-mr-24 lg:h-[640px]">
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    'radial-gradient(50% 50% at 60% 45%, rgba(152,251,152,0.08) 0%, transparent 70%)',
                }}
              />
              <Globe className="absolute inset-0 h-full w-full" />
            </div>
          </div>
        </div>
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-24"
          style={{ background: 'linear-gradient(to bottom, transparent, var(--background))' }}
        />
      </section>

      {/* Features */}
      <section className="relative overflow-hidden border-b border-border">
        <ThinkerScene
          className="absolute inset-0 h-full w-full opacity-70"
          style={{
            maskImage: 'linear-gradient(to bottom, transparent, black 12%, black 88%, transparent)',
            WebkitMaskImage:
              'linear-gradient(to bottom, transparent, black 12%, black 88%, transparent)',
          }}
        />
        <div className="pointer-events-none relative z-10 mx-auto max-w-content px-6 py-24">
          <h2 className="max-w-xl text-heading-sm font-medium tracking-heading">
            Everything a handshake deal was missing.
          </h2>
          <div className="mt-14 grid gap-px overflow-hidden rounded-lg bg-border sm:grid-cols-2">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-card p-6">
                <f.icon className="h-4 w-4 text-[#98fb98]" />
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
          <span>Agora, the AI-powered trust layer for P2P commerce on Nimiq</span>
          <span className="font-mono">Nimiq Mini Apps</span>
        </div>
      </footer>
    </div>
  )
}
