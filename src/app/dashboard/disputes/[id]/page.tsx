'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { formatDate } from '@/lib/utils'

interface Dispute {
  id: string
  status: string
  reason: string
  caseSummary?: string
  findings?: string
  recommendedOutcome?: string
  createdAt: string
  opener: { displayName: string; id: string }
  respondent: { displayName: string; id: string }
  agreement: {
    id: string
    title: string
    description: string
  }
}

const verdictColors: Record<string, string> = {
  release: 'bg-green-100 text-green-800',
  refund: 'bg-blue-100 text-blue-800',
  partial_refund: 'bg-yellow-100 text-yellow-800',
  escalate: 'bg-red-100 text-red-800',
}

export default function DisputeDetailPage() {
  const router = useRouter()
  const params = useParams()
  const disputeId = params.id as string

  const [dispute, setDispute] = useState<Dispute | null>(null)
  const [loading, setLoading] = useState(true)
  const [meditating, setMeditating] = useState(false)
  const [user, setUser] = useState<{ id: string } | null>(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        const res = await fetch(`/api/disputes/${disputeId}`, { credentials: 'include' })

        if (!res.ok) {
          router.push('/login')
          return
        }

        const data = await res.json()
        setDispute(data)

        const sessionRes = await fetch('/api/auth/session', { credentials: 'include' })
        if (sessionRes.ok) {
          const sessionData = await sessionRes.json()
          setUser(sessionData.user)
        }
      } catch (err) {
        console.error('Failed to load dispute:', err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [disputeId, router])

  const handleGetVerdict = async () => {
    if (!dispute) return
    setMeditating(true)

    try {
      const res = await fetch(`/api/disputes/${disputeId}/resolve`, {
        method: 'POST',
        credentials: 'include',
      })

      if (!res.ok) {
        throw new Error('Failed to generate verdict')
      }

      const updated = await res.json()
      setDispute(updated)
    } catch (err) {
      console.error('Error getting verdict:', err)
    } finally {
      setMeditating(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  if (!dispute) {
    return <div className="flex items-center justify-center min-h-screen">Dispute not found</div>
  }

  const isOpener = user?.id === dispute.opener.id
  const isRespondent = user?.id === dispute.respondent.id

  return (
    <div className="max-w-4xl mx-auto py-8">
      {/* Header */}
      <div className="bg-white p-8 rounded-lg shadow mb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-3xl font-bold">{dispute.agreement.title}</h1>
            <p className="text-muted-foreground mt-2">Dispute Opened</p>
          </div>
          <span
            className={`px-4 py-2 rounded-lg text-sm font-semibold ${
              dispute.status === 'resolved'
                ? 'bg-green-100 text-green-800'
                : dispute.status === 'under_review'
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-red-100 text-red-800'
            }`}
          >
            {dispute.status.replace('_', ' ').toUpperCase()}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-muted-foreground text-sm">Opener (Plaintiff)</p>
            <p className="text-lg font-semibold">{dispute.opener.displayName}</p>
            {isOpener && <p className="text-xs text-blue-600 mt-1">You</p>}
          </div>
          <div>
            <p className="text-muted-foreground text-sm">Respondent (Defendant)</p>
            <p className="text-lg font-semibold">{dispute.respondent.displayName}</p>
            {isRespondent && <p className="text-xs text-blue-600 mt-1">You</p>}
          </div>
        </div>

        <div className="mt-4 pt-4 border-t">
          <p className="text-sm font-semibold mb-2">Reason for Dispute:</p>
          <p className="text-sm">{dispute.reason}</p>
        </div>
      </div>

      {/* AI Verdict Section */}
      {dispute.status === 'open' ? (
        <div className="bg-blue-50 border border-blue-200 p-8 rounded-lg mb-6 text-center">
          <h2 className="text-xl font-bold mb-2">Get AI Mediator Verdict</h2>
          <p className="text-sm text-muted-foreground mb-6">
            The AI mediator will review the agreement, timeline, and messages to provide a fair
            verdict.
          </p>
          <button
            onClick={handleGetVerdict}
            disabled={meditating}
            className="bg-accent text-accent-foreground px-8 py-3 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {meditating ? '🤖 AI Mediating...' : 'Generate AI Verdict'}
          </button>
        </div>
      ) : dispute.status === 'under_review' || dispute.status === 'resolved' ? (
        <div className="bg-white p-8 rounded-lg shadow mb-6">
          <h2 className="text-2xl font-bold mb-6">⚖️ AI Mediator Verdict</h2>

          <div className="mb-8">
            <p className="text-muted-foreground text-sm mb-2">Recommended Outcome:</p>
            <span
              className={`inline-block px-4 py-2 rounded-lg text-sm font-semibold ${
                verdictColors[dispute.recommendedOutcome || 'release']
              }`}
            >
              {(dispute.recommendedOutcome || 'PENDING').replace('_', ' ').toUpperCase()}
            </span>
          </div>

          {dispute.caseSummary && (
            <div className="mb-6">
              <h3 className="font-semibold mb-2">Case Summary</h3>
              <p className="text-sm text-gray-700">{dispute.caseSummary}</p>
            </div>
          )}

          {dispute.findings && (
            <div className="mb-6">
              <h3 className="font-semibold mb-2">Findings</h3>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{dispute.findings}</p>
            </div>
          )}

          {dispute.status === 'under_review' && (
            <div className="bg-yellow-50 border border-yellow-200 p-4 rounded mt-6">
              <p className="text-sm">
                <span className="font-semibold">Next Step:</span> Both parties must accept this
                verdict for it to be binding. Contact the other party to reach agreement.
              </p>
            </div>
          )}

          {dispute.status === 'resolved' && (
            <div className="bg-green-50 border border-green-200 p-4 rounded mt-6">
              <p className="text-sm text-green-800">
                ✓ <span className="font-semibold">Dispute Resolved</span> — Both parties accepted
                the verdict.
              </p>
            </div>
          )}
        </div>
      ) : null}

      {/* Related Agreement */}
      <div className="bg-white p-8 rounded-lg shadow">
        <h3 className="font-bold mb-4">Related Agreement</h3>
        <p className="text-sm font-semibold mb-2">{dispute.agreement.title}</p>
        <p className="text-sm text-muted-foreground mb-4">{dispute.agreement.description}</p>
        <a
          href={`/dashboard/agreements/${dispute.agreement.id}`}
          className="text-blue-600 text-sm font-semibold hover:underline"
        >
          View Agreement →
        </a>
      </div>
    </div>
  )
}
