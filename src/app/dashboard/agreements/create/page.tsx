'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

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

export default function CreateAgreementPage() {
  const router = useRouter()
  const [step, setStep] = useState<'input' | 'review' | 'creating'>('input')
  const [userInput, setUserInput] = useState('')
  const [generated, setGenerated] = useState<GeneratedAgreement | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/ai/generate-agreement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userRequest: userInput }),
        credentials: 'include',
      })

      if (!res.ok) {
        throw new Error('Failed to generate agreement')
      }

      const data = await res.json()
      setGenerated(data)
      setStep('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
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

      if (!res.ok) {
        throw new Error('Failed to create agreement')
      }

      const agreement = await res.json()
      router.push(`/dashboard/agreements/${agreement.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setStep('review')
    }
  }

  if (step === 'input') {
    return (
      <div className="max-w-2xl mx-auto py-8">
        <h1 className="text-3xl font-bold mb-6">Create Agreement</h1>

        <form onSubmit={handleGenerate} className="bg-white p-8 rounded-lg shadow">
          <label className="block mb-4">
            <p className="font-semibold mb-2">What do you need?</p>
            <p className="text-sm text-muted-foreground mb-3">
              Describe your project or task in plain English. AI will generate a full contract with milestones,
              terms, and risk flags.
            </p>
            <textarea
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="e.g., Build me a landing page for $500 in 7 days with 3 revisions included"
              className="w-full border border-border rounded-lg p-4 font-mono text-sm"
              rows={5}
            />
          </label>

          <button
            type="submit"
            disabled={loading || !userInput.trim()}
            className="bg-accent text-accent-foreground px-6 py-2 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {loading ? '🤖 AI Generating...' : 'Generate Agreement'}
          </button>

          {error && <p className="text-destructive text-sm mt-4">{error}</p>}
        </form>
      </div>
    )
  }

  if (step === 'review' && generated) {
    return (
      <div className="max-w-4xl mx-auto py-8">
        <h1 className="text-3xl font-bold mb-6">Review Agreement</h1>

        <div className="bg-white p-8 rounded-lg shadow mb-6">
          <div className="grid grid-cols-2 gap-6 mb-8">
            <div>
              <p className="text-muted-foreground text-sm">Title</p>
              <p className="text-xl font-bold">{generated.title}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Amount</p>
              <p className="text-xl font-bold">{generated.amount_nim} NIM</p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Timeline</p>
              <p className="text-xl font-bold">{generated.timeline_days} days</p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Milestones</p>
              <p className="text-xl font-bold">{generated.milestones.length}</p>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="font-semibold mb-2">Scope</h3>
            <p className="text-sm text-gray-600">{generated.scope}</p>
          </div>

          <div className="mb-6">
            <h3 className="font-semibold mb-2">Deliverables</h3>
            <ul className="list-disc list-inside text-sm space-y-1">
              {generated.deliverables.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          </div>

          <div className="mb-6">
            <h3 className="font-semibold mb-2">Milestones</h3>
            <div className="space-y-2">
              {generated.milestones.map((m, i) => (
                <div key={i} className="bg-slate-50 p-3 rounded">
                  <p className="font-semibold text-sm">{m.title}</p>
                  <p className="text-xs text-muted-foreground">{m.description}</p>
                </div>
              ))}
            </div>
          </div>

          {generated.risk_flags.length > 0 && (
            <div className="mb-6 bg-yellow-50 border border-yellow-200 p-4 rounded">
              <h3 className="font-semibold mb-2 text-sm text-yellow-900">⚠️ Risk Flags</h3>
              <ul className="list-disc list-inside text-sm space-y-1 text-yellow-800">
                {generated.risk_flags.map((flag, i) => (
                  <li key={i}>{flag}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-4">
            <button
              onClick={() => {
                setStep('input')
                setGenerated(null)
              }}
              className="bg-muted text-foreground px-6 py-2 rounded-lg font-semibold hover:opacity-90"
            >
              Back
            </button>
            <button
              onClick={handleCreate}
              className="bg-accent text-accent-foreground px-6 py-2 rounded-lg font-semibold hover:opacity-90"
            >
              Create Agreement
            </button>
          </div>

          {error && <p className="text-destructive text-sm mt-4">{error}</p>}
        </div>
      </div>
    )
  }

  if (step === 'creating') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-lg font-semibold mb-2">Creating your agreement...</p>
          <p className="text-muted-foreground">This may take a moment.</p>
        </div>
      </div>
    )
  }

  return null
}
