'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Briefcase, Check, Search, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageLoading, Spinner } from '@/components/ui/page'
import { shortAddress } from '@/lib/utils'
import type { UserRole } from '@/lib/types'

const OPTIONS: {
  role: UserRole
  icon: LucideIcon
  title: string
  tagline: string
  bullets: string[]
}[] = [
  {
    role: 'provider',
    icon: Briefcase,
    title: 'I offer a service',
    tagline: 'Designer, developer, writer, translator — anyone selling work.',
    bullets: [
      'See the payment locked in escrow before you start',
      'Submit milestones and claim funds on approval',
      'Build a portable trust score with every delivery',
    ],
  },
  {
    role: 'client',
    icon: Search,
    title: 'I need a service',
    tagline: 'You have work that needs doing and a budget to back it.',
    bullets: [
      'Describe the job — AI drafts the agreement for you',
      'Fund a Nimiq HTLC that only releases on your approval',
      'Open a dispute for AI mediation if the work falls short',
    ],
  },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [address, setAddress] = useState('')
  const [selected, setSelected] = useState<UserRole | null>(null)
  const [checking, setChecking] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/auth/session', { credentials: 'include' })
        if (!res.ok) {
          router.replace('/')
          return
        }
        const { user } = await res.json()
        // Already picked a side — nothing to do here.
        if (user.role) {
          router.replace('/dashboard')
          return
        }
        setAddress(user.address)
        setChecking(false)
      } catch {
        router.replace('/')
      }
    }
    load()
  }, [router])

  const submit = async () => {
    if (!selected) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/auth/role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: selected }),
        credentials: 'include',
      })
      if (!res.ok) {
        const detail = await res.text().catch(() => '')
        setError(`Could not save your choice (${res.status}). ${detail.slice(0, 200)}`)
        setSaving(false)
        return
      }
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setSaving(false)
    }
  }

  if (checking) return <PageLoading label="Checking your wallet" />

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-content items-center justify-between px-6">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" className="h-6 w-6" />
            <span className="text-[15px] font-medium tracking-body">Agora</span>
          </div>
          {address && (
            <span className="font-mono text-[12px] text-subtle-foreground">
              {shortAddress(address)}
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
        <p className="font-mono text-[12px] text-subtle-foreground">Wallet connected</p>
        <h1 className="mt-3 text-heading-sm font-medium tracking-heading">
          Which side are you on?
        </h1>
        <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
          Agora has two kinds of people. Pick the one that fits — it shapes your dashboard and
          which side of the escrow you sit on. You can switch later from your profile.
        </p>

        <div className="mt-10 grid gap-3 sm:grid-cols-2">
          {OPTIONS.map((option) => {
            const active = selected === option.role
            return (
              <button
                key={option.role}
                type="button"
                onClick={() => setSelected(option.role)}
                aria-pressed={active}
                className={`rounded-lg bg-card p-6 text-left transition-colors ${
                  active
                    ? 'shadow-[inset_0_0_0_1px_var(--accent)] bg-surface'
                    : 'shadow-hairline hover:bg-surface'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                      active ? 'bg-accent' : 'bg-white/[0.04]'
                    }`}
                  >
                    <option.icon
                      className={`h-4 w-4 ${active ? 'text-accent-foreground' : 'text-muted-foreground'}`}
                      strokeWidth={2}
                    />
                  </div>
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full transition-colors ${
                      active ? 'bg-accent' : 'shadow-hairline'
                    }`}
                  >
                    {active && (
                      <Check className="h-3 w-3 text-accent-foreground" strokeWidth={3} />
                    )}
                  </span>
                </div>

                <h2 className="mt-5 text-[17px] font-medium tracking-body">{option.title}</h2>
                <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">
                  {option.tagline}
                </p>

                <ul className="mt-5 space-y-2 border-t border-border pt-4">
                  {option.bullets.map((bullet) => (
                    <li key={bullet} className="flex gap-2.5 text-[13px] leading-relaxed">
                      <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-subtle-foreground" />
                      <span className="text-secondary-foreground">{bullet}</span>
                    </li>
                  ))}
                </ul>
              </button>
            )
          })}
        </div>

        <div className="mt-8 flex items-center gap-4">
          <Button size="lg" onClick={submit} disabled={!selected || saving}>
            {saving ? <Spinner className="h-4 w-4" /> : null}
            {saving ? 'Setting up' : 'Continue'}
            {!saving && <ArrowRight className="h-4 w-4" />}
          </Button>
          {!selected && (
            <span className="text-[13px] text-subtle-foreground">Pick one to continue.</span>
          )}
        </div>

        {error && <p className="mt-4 text-[13px] text-destructive">{error}</p>}
      </main>
    </div>
  )
}
