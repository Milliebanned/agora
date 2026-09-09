'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, AlertTriangle, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Textarea } from '@/components/ui/input'
import { PageHeader, Spinner } from '@/components/ui/page'

interface GeneratedAgreement {
  title: string
  scope: string
  deliverables: string[]
  timeline_days: number
  milestones: Array<{ title: string; description: string }>
  amount_nim: number
  completion_conditions: string
  refund_conditions: string
  risk_flags: string[]
}

const EXAMPLE = 'Build me a landing page for 500 NIM in 7 days, with 3 rounds of revisions included'

export default function CreateAgreementPage() {
  const router = useRouter()
  const [step, setStep] = useState<'input' | 'review' | 'creating'>('input')
  const [userInput, setUserInput] = useState('')
  const [generated, setGenerated] = useState<GeneratedAgreement | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [elapsed, setElapsed] = useState(0)

  // Drafting runs anywhere from 7s to a minute depending on how busy the model
  // is, so the button shows a running count rather than an inert spinner.
  useEffect(() => {
    if (!loading) return
    setElapsed(0)
    const id = setInterval(() => setElapsed((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [loading])

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Without this the request can hang forever inside the Nimiq Pay WebView,
    // which reads as "stuck loading" with nothing to act on.
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 70000)

    try {
      const res = await fetch('/api/ai/generate-agreement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userRequest: userInput }),
        credentials: 'include',
        signal: controller.signal,
      })

      if (!res.ok) {
        // Report what the server actually said instead of guessing at the cause.
        const body = await res.json().catch(() => null)
        throw new Error(
          body?.error
            ? `${body.error}${body.detail ? ` — ${String(body.detail).slice(0, 200)}` : ''}`
            : `Agreement generation failed (${res.status})`,
        )
      }

      setGenerated(await res.json())
      setStep('review')
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setError('The model took too long to respond. Tap Generate to try again.')
      } else {
        setError(err instanceof Error ? err.message : 'An error occurred')
      }
    } finally {
      clearTimeout(timeout)
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!generated) return
    setStep('creating')
    setError('')
    try {
      const res = await fetch('/api/agreements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: generated.title,
          description: generated.scope,
          amountNIM: generated.amount_nim,
          deadline: new Date(Date.now() + generated.timeline_days * 86400000).toISOString(),
          deliverables: generated.deliverables,
          completionTerms: generated.completion_conditions,
          refundTerms: generated.refund_conditions,
          riskFlags: generated.risk_flags,
        }),
        credentials: 'include',
      })
      if (!res.ok) throw new Error('Failed to create agreement')
      const agreement = await res.json()
      router.push(`/dashboard/agreements/${agreement.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setStep('review')
    }
  }

  if (step === 'creating') {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <Spinner className="h-5 w-5" />
        <p className="text-[15px] font-medium">Creating your agreement</p>
        <p className="text-[13px] text-muted-foreground">Writing terms to the ledger…</p>
      </div>
    )
  }

  if (step === 'review' && generated) {
    return (
      <>
        <button
          onClick={() => setStep('input')}
          className="mb-6 flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to description
        </button>

        <PageHeader title="Review agreement" description="Drafted by AI from your description." />

        <Card>
          <div className="grid grid-cols-2 gap-px bg-border lg:grid-cols-4">
            {[
              ['Amount', `${generated.amount_nim} NIM`],
              ['Timeline', `${generated.timeline_days} days`],
              ['Milestones', String(generated.milestones.length)],
              ['Deliverables', String(generated.deliverables.length)],
            ].map(([label, value]) => (
              <div key={label} className="bg-card p-5">
                <p className="text-[13px] text-muted-foreground">{label}</p>
                <p className="mt-1.5 text-[20px] font-medium tabular-nums tracking-heading">
                  {value}
                </p>
              </div>
            ))}
          </div>

          <div className="space-y-6 border-t border-border p-6">
            <div>
              <h2 className="text-[18px] font-medium tracking-heading">{generated.title}</h2>
              <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
                {generated.scope}
              </p>
            </div>

            <div>
              <p className="mb-2.5 text-[13px] font-medium text-secondary-foreground">
                Deliverables
              </p>
              <ul className="space-y-1.5">
                {generated.deliverables.map((d, i) => (
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
              <p className="mb-2.5 text-[13px] font-medium text-secondary-foreground">Milestones</p>
              <div className="overflow-hidden rounded-md shadow-hairline">
                {generated.milestones.map((m, i) => (
                  <div
                    key={i}
                    className={`bg-white/[0.02] px-4 py-3 ${i > 0 ? 'border-t border-border' : ''}`}
                  >
                    <p className="text-[14px] text-secondary-foreground">{m.title}</p>
                    <p className="mt-1 text-[13px] text-muted-foreground">{m.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <p className="mb-1.5 text-[13px] font-medium text-secondary-foreground">
                  Completion terms
                </p>
                <p className="text-[13px] leading-relaxed text-muted-foreground">
                  {generated.completion_conditions}
                </p>
              </div>
              <div>
                <p className="mb-1.5 text-[13px] font-medium text-secondary-foreground">
                  Refund terms
                </p>
                <p className="text-[13px] leading-relaxed text-muted-foreground">
                  {generated.refund_conditions}
                </p>
              </div>
            </div>

            {generated.risk_flags.length > 0 && (
              <div className="rounded-md border border-destructive/25 bg-destructive/[0.06] p-4">
                <p className="mb-2 flex items-center gap-2 text-[13px] font-medium text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Risk flags
                </p>
                <ul className="space-y-1">
                  {generated.risk_flags.map((flag, i) => (
                    <li key={i} className="text-[13px] leading-relaxed text-destructive/85">
                      {flag}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2.5 border-t border-border px-6 py-4">
            <Button onClick={handleCreate}>Create agreement</Button>
            <Button variant="secondary" onClick={() => setStep('input')}>
              Edit description
            </Button>
            {error && <p className="ml-2 text-[13px] text-destructive">{error}</p>}
          </div>
        </Card>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="New agreement"
        description="Describe the deal in plain English. AI turns it into a structured contract."
      />

      <Card>
        <form onSubmit={handleGenerate} className="p-6">
          <label htmlFor="deal" className="text-[13px] font-medium text-secondary-foreground">
            What is the deal?
          </label>
          <Textarea
            id="deal"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder={EXAMPLE}
            rows={5}
            className="mt-2.5"
          />
          <button
            type="button"
            onClick={() => setUserInput(EXAMPLE)}
            className="mt-2.5 text-[12px] text-subtle-foreground transition-colors hover:text-muted-foreground"
          >
            Use the example →
          </button>

          <div className="mt-5 flex items-center gap-3">
            <Button type="submit" disabled={loading || !userInput.trim()}>
              {loading ? <Spinner className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
              {loading ? `Drafting… ${elapsed}s` : 'Generate agreement'}
            </Button>
            <span className="text-[12px] text-subtle-foreground">
              {loading ? 'Can take up to a minute' : 'Usually under a minute'}
            </span>
          </div>

          {error && <p className="mt-4 text-[13px] text-destructive">{error}</p>}
        </form>
      </Card>
    </>
  )
}
