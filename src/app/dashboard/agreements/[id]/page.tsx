'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { formatDate, shortAddress, parseJsonArray } from '@/lib/utils'

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
  escrowTransactions: Array<{
    type: string
    status: string
    txHash?: string
    createdAt: string
  }>
  messages: Array<{
    id: string
    type: string
    content: string
    createdAt: string
    sender?: { displayName: string }
  }>
}

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  active: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  disputed: 'bg-red-100 text-red-800',
}

export default function AgreementDetailPage() {
  const router = useRouter()
  const params = useParams()
  const agreementId = params.id as string

  const [agreement, setAgreement] = useState<Agreement | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [fundingLoading, setFundingLoading] = useState(false)
  const [newMessage, setNewMessage] = useState('')
  const [messageSending, setMessageSending] = useState(false)
  const [showDisputeForm, setShowDisputeForm] = useState(false)
  const [disputeReason, setDisputeReason] = useState('')
  const [openingDispute, setOpeningDispute] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      try {
        const res = await fetch(`/api/agreements/${agreementId}`, { credentials: 'include' })

        if (!res.ok) {
          router.push('/login')
          return
        }

        const data = await res.json()
        setAgreement(data)

        const sessionRes = await fetch('/api/auth/session', { credentials: 'include' })
        if (sessionRes.ok) {
          const sessionData = await sessionRes.json()
          setUser(sessionData.user)
        }
      } catch (err) {
        setError('Failed to load agreement')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [agreementId, router])

  const handleFundEscrow = async () => {
    if (!agreement) return
    setFundingLoading(true)
    setError('')

    try {
      const res = await fetch(`/api/agreements/${agreementId}/fund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        credentials: 'include',
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to prepare escrow')
      }

      const { htlcData } = await res.json()
      alert('✅ Escrow prepared!\n\nIn real Nimiq Pay, sign the HTLC transaction now.\n\n' +
        `Hash Root: ${htlcData.hash_root?.substring(0, 16)}...`)

      const refreshRes = await fetch(`/api/agreements/${agreementId}`, { credentials: 'include' })
      if (refreshRes.ok) {
        setAgreement(await refreshRes.json())
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setFundingLoading(false)
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim()) return

    setMessageSending(true)

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agreementId, content: newMessage }),
        credentials: 'include',
      })

      if (res.ok) {
        const msg = await res.json()
        if (agreement) {
          setAgreement({
            ...agreement,
            messages: [...agreement.messages, msg],
          })
        }
        setNewMessage('')
      }
    } catch (err) {
      setError('Failed to send message')
    } finally {
      setMessageSending(false)
    }
  }

  const handleOpenDispute = async () => {
    if (!disputeReason.trim()) {
      setError('Please enter a reason for the dispute')
      return
    }

    setOpeningDispute(true)

    try {
      const res = await fetch('/api/disputes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agreementId, reason: disputeReason }),
        credentials: 'include',
      })

      if (res.ok) {
        alert('✅ Dispute opened. AI Mediator will review.')
        router.push('/dashboard/disputes')
      } else {
        throw new Error('Failed to open dispute')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open dispute')
    } finally {
      setOpeningDispute(false)
      setShowDisputeForm(false)
    }
  }

  const handleApproveMilestone = async (milestoneId: string) => {
    try {
      const res = await fetch(`/api/agreements/${agreementId}/milestones`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ milestoneId, status: 'approved' }),
        credentials: 'include',
      })

      if (res.ok) {
        alert('✅ Milestone approved! Funds will be released.')
        const refreshRes = await fetch(`/api/agreements/${agreementId}`, { credentials: 'include' })
        if (refreshRes.ok) {
          setAgreement(await refreshRes.json())
        }
      }
    } catch (err) {
      setError('Failed to approve milestone')
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  if (!agreement) {
    return <div className="flex items-center justify-center min-h-screen">Agreement not found</div>
  }

  const isBuyer = user?.id === agreement.buyer.id
  const isSeller = user?.id === agreement.seller?.id
  const riskFlags = parseJsonArray(agreement.riskFlags)

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="bg-white p-8 rounded-lg shadow mb-6">
        <div className="flex justify-between items-start mb-6">
          <div className="flex-1">
            <h1 className="text-3xl font-bold">{agreement.title}</h1>
            <p className="text-muted-foreground mt-2">{agreement.description}</p>
          </div>
          <span className={`px-4 py-2 rounded-lg text-sm font-semibold ${statusColors[agreement.status]}`}>
            {agreement.status.toUpperCase()}
          </span>
        </div>

        <div className="grid grid-cols-4 gap-6">
          <div>
            <p className="text-muted-foreground text-sm">Amount</p>
            <p className="text-2xl font-bold">{agreement.amountNIM} NIM</p>
          </div>
          <div>
            <p className="text-muted-foreground text-sm">Deadline</p>
            <p className="text-lg font-semibold">{formatDate(agreement.deadline)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-sm">Buyer</p>
            <p className="text-sm font-semibold">{agreement.buyer.displayName}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-sm">Seller</p>
            <p className="text-sm font-semibold">{agreement.seller?.displayName || 'Pending'}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="col-span-2 space-y-6">
          {/* Escrow Status */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-bold mb-4">💰 Escrow Status</h2>
            {agreement.htlcAddress ? (
              <div className="space-y-3">
                <div className="bg-green-50 border border-green-200 p-4 rounded">
                  <p className="text-green-800 font-semibold">✅ Funded</p>
                </div>
                {agreement.escrowTransactions.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold mb-2">Transactions:</p>
                    <div className="space-y-2">
                      {agreement.escrowTransactions.map((tx, i) => (
                        <div key={i} className="text-xs bg-gray-50 p-2 rounded">
                          <p className="font-semibold capitalize">{tx.type}: {tx.status}</p>
                          <p className="text-muted-foreground">{formatDate(tx.createdAt)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : isBuyer ? (
              <button
                onClick={handleFundEscrow}
                disabled={fundingLoading}
                className="bg-accent text-accent-foreground px-6 py-2 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 w-full"
              >
                {fundingLoading ? '⏳ Preparing...' : '🔒 Fund Escrow (HTLC)'}
              </button>
            ) : (
              <p className="text-sm text-muted-foreground">Awaiting buyer to fund escrow...</p>
            )}
          </div>

          {/* Milestones */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-bold mb-4">📋 Milestones</h2>
            {agreement.milestones.length === 0 ? (
              <p className="text-sm text-muted-foreground">No milestones created yet</p>
            ) : (
              <div className="space-y-3">
                {agreement.milestones.map((ms) => (
                  <div key={ms.id} className="border border-border p-4 rounded">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-semibold">{ms.title}</h3>
                        <p className="text-xs text-muted-foreground mt-1">Created: {formatDate(ms.createdAt)}</p>
                      </div>
                      <span
                        className={`text-xs font-semibold px-2 py-1 rounded ${
                          ms.status === 'approved'
                            ? 'bg-green-100 text-green-800'
                            : ms.status === 'submitted'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {ms.status.toUpperCase()}
                      </span>
                    </div>
                    {isBuyer && ms.status === 'submitted' && (
                      <button
                        onClick={() => handleApproveMilestone(ms.id)}
                        className="text-sm bg-green-100 text-green-800 px-3 py-1 rounded hover:bg-green-200 font-semibold"
                      >
                        ✓ Approve
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Risk Flags */}
          {riskFlags.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 p-6 rounded-lg">
              <h2 className="text-lg font-bold mb-3">⚠️ Risk Flags</h2>
              <ul className="space-y-1">
                {riskFlags.map((flag, i) => (
                  <li key={i} className="text-sm">• {flag}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Messages */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-bold mb-4">💬 Messages</h2>
            <div className="bg-gray-50 p-4 rounded mb-4 max-h-64 overflow-y-auto min-h-32">
              {agreement.messages.length === 0 ? (
                <p className="text-sm text-muted-foreground">No messages yet</p>
              ) : (
                <div className="space-y-3">
                  {agreement.messages.slice(-10).map((msg) => (
                    <div key={msg.id} className="text-sm">
                      <p className="font-semibold text-xs text-muted-foreground">
                        {msg.type === 'system' ? '🔔 System' : msg.sender?.displayName || 'Unknown'}
                      </p>
                      <p className="text-gray-700">{msg.content}</p>
                      <p className="text-xs text-muted-foreground mt-1">{formatDate(msg.createdAt)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Send a message..."
                className="flex-1 border border-border rounded p-2 text-sm"
                disabled={messageSending}
              />
              <button
                type="submit"
                disabled={messageSending || !newMessage.trim()}
                className="bg-blue-600 text-white px-4 py-2 rounded font-semibold text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                Send
              </button>
            </form>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="font-bold mb-4">Quick Actions</h3>
            <div className="space-y-2">
              {!showDisputeForm ? (
                <>
                  <button
                    onClick={() => setShowDisputeForm(true)}
                    className="w-full bg-red-100 text-red-800 px-4 py-2 rounded font-semibold text-sm hover:bg-red-200"
                  >
                    ⚠️ Open Dispute
                  </button>
                  <button className="w-full bg-gray-100 text-gray-800 px-4 py-2 rounded font-semibold text-sm hover:bg-gray-200">
                    📞 Contact Support
                  </button>
                </>
              ) : (
                <div className="space-y-3 bg-red-50 p-4 rounded border border-red-200">
                  <p className="text-sm font-semibold">Why are you opening a dispute?</p>
                  <textarea
                    value={disputeReason}
                    onChange={(e) => setDisputeReason(e.target.value)}
                    className="w-full border border-border rounded p-2 text-sm"
                    rows={3}
                    placeholder="Explain the issue..."
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleOpenDispute}
                      disabled={openingDispute}
                      className="flex-1 bg-red-600 text-white px-3 py-2 rounded font-semibold text-sm hover:bg-red-700 disabled:opacity-50"
                    >
                      {openingDispute ? 'Opening...' : 'Open Dispute'}
                    </button>
                    <button
                      onClick={() => setShowDisputeForm(false)}
                      className="flex-1 bg-gray-300 text-gray-800 px-3 py-2 rounded font-semibold text-sm hover:bg-gray-400"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Status Info */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="font-bold mb-4">Status</h3>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground">Created</p>
                <p className="font-semibold">{formatDate(agreement.createdAt)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Status</p>
                <p className="font-semibold capitalize">{agreement.status}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-6 bg-red-50 border border-red-200 text-red-800 p-4 rounded">
          {error}
        </div>
      )}
    </div>
  )
}
