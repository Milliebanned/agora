'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Briefcase, Check, Search, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
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
    tagline: 'Designer, developer, writer, translator: anyone selling work.',
    bullets: [
      'Every job on the board has its budget in escrow before you write a word',
      'Advertise what you do and what you charge, and get hired straight from it',
      'Claim the escrow yourself once your work is approved',
    ],
  },
  {
    role: 'client',
    icon: Search,
    title: 'I need a service',
    tagline: 'You have work that needs doing and a budget to back it.',
    bullets: [
      'Post a job, or hire a freelancer straight from their advertisement',
      'Your budget sits in escrow and is returned if you withdraw',
      'Nothing is paid out until you approve the work',
    ],
  },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [address, setAddress] = useState('')
  const [userId, setUserId] = useState('')
  // Two steps, shown once: pick a side, then say who you are. The second is
  // skippable because a wallet that just wants to look around should not be
  // held at a form, and everything on it is editable later in the profile.
  const [step, setStep] = useState<'side' | 'details'>('side')
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
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
        // Already picked a side, so nothing to do here.
        if (user.role) {
          router.replace('/dashboard')
          return
        }
        setAddress(user.address)
        setUserId(user.id)
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
      // The side is saved. Asking who they are comes next, and reloading from
      // here lands them on the dashboard rather than repeating this.
      setStep('details')
      setSaving(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setSaving(false)
    }
  }

  const saveDetails = async () => {
    if (!displayName.trim() && !bio.trim()) {
      router.push('/dashboard')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ displayName: displayName.trim(), bio: bio.trim() }),
      })
      if (!res.ok) {
        const detail = await res.text().catch(() => '')
        setError(`Could not save your details (${res.status}). ${detail.slice(0, 200)}`)
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
        {step === 'details' ? (
          <>
            <p className="font-mono text-[12px] text-subtle-foreground">Step 2 of 2</p>
            <h1 className="mt-3 text-heading-sm font-medium tracking-heading">
              Who are people dealing with?
            </h1>
            <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
              A wallet address tells a stranger nothing. A name and a line about what you do is the
              difference between a proposal someone reads and one they scroll past. You can skip
              this and add it later from your profile.
            </p>

            <div className="mt-10 max-w-xl space-y-5">
              <div>
                <label
                  htmlFor="onboarding-name"
                  className="text-[13px] font-medium text-secondary-foreground"
                >
                  Display name
                </label>
                <p className="mt-0.5 text-[12px] text-subtle-foreground">
                  Shown on your proposals, your postings and your profile.
                </p>
                <Input
                  id="onboarding-name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Jane Mensah"
                  maxLength={60}
                  className="mt-2"
                />
              </div>

              <div>
                <label
                  htmlFor="onboarding-bio"
                  className="text-[13px] font-medium text-secondary-foreground"
                >
                  Short bio
                </label>
                <p className="mt-0.5 text-[12px] text-subtle-foreground">
                  What you do, and anything that would make someone pick you.
                </p>
                <Textarea
                  id="onboarding-bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={4}
                  maxLength={600}
                  placeholder="Product designer, eight years on fintech and wallets. I work in small scopes and ship fast."
                  className="mt-2"
                />
              </div>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button size="lg" onClick={saveDetails} disabled={saving}>
                {saving ? <Spinner className="h-4 w-4" /> : null}
                {saving ? 'Saving' : 'Save and continue'}
                {!saving && <ArrowRight className="h-4 w-4" />}
              </Button>
              <Button
                size="lg"
                variant="secondary"
                disabled={saving}
                onClick={() => router.push('/dashboard')}
              >
                Skip for now
              </Button>
            </div>

            {error && <p className="mt-4 text-[13px] text-destructive">{error}</p>}
          </>
        ) : (
          <>
        <p className="font-mono text-[12px] text-subtle-foreground">Wallet connected</p>
        <h1 className="mt-3 text-heading-sm font-medium tracking-heading">
          Which side are you on?
        </h1>
        <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
          Agora has two kinds of people. Pick the one that fits: it shapes your dashboard and
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
                    ? 'shadow-[inset_0_0_0_1px_#3bb143] bg-surface'
                    : 'shadow-hairline hover:bg-surface'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                      active ? 'bg-[#3bb143]' : 'bg-white/[0.04]'
                    }`}
                  >
                    <option.icon
                      className={`h-4 w-4 ${active ? 'text-white' : 'text-muted-foreground'}`}
                      strokeWidth={2}
                    />
                  </div>
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full transition-colors ${
                      active ? 'bg-[#3bb143]' : 'shadow-hairline'
                    }`}
                  >
                    {active && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
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
          </>
        )}
      </main>
    </div>
  )
}
