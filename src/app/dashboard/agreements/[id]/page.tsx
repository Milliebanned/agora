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

        // Get current user ID from session
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
      // Call HTLC creation endpoint (will be implemented in Day 2)
      const res = await fetch(`/api/agreements/${agreementId}/fund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        credentials: 'include',
      })

      if (!res.ok) {
        throw new Error('Failed to fund escrow')
      }

      // Refresh agreement
      const refreshRes = await fetch(`/api/agreements/${agreementId}`, { credentials: 'include' })
      if (refreshRes.ok) {
        const updated = await refreshRes.json()
        setAgreement(updated)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setFundingLoading(false)
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
    <div className="max-w-6xl mx-auto py-8">
      {/* Header */}
      <div className="bg-white p-8 rounded-lg shadow mb-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold">{agreement.title}</h1>
            <p className="text-muted-foreground mt-2">{agreement.description}</p>
          </div>
          <span
            className={`px-4 py-2 rounded-lg text-sm font-semibold ${
              statusColors[agreement.status]
            }`}
          >
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
            <p className="text-xs text-muted-foreground">{shortAddress(agreement.buyer.address)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-sm">Seller</p>
            <p className="text-sm font-semibold">{agreement.seller?.displayName || 'Pending'}</p>
            {agreement.seller && (
              <p className="text-xs text-muted-foreground">{shortAddress(agreement.seller.address)}</p>
            )}
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
              <div className="space-y-2">
                <p className="text-sm">
                  <span className="font-semibold">Status:</span> Funded
                </p>
                <p className="text-sm">
                  <span className="font-semibold">HTLC Address:</span>{' '}
                  <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                    {shortAddress(agreement.htlcAddress, 10)}
                  </code>
                </p>
                {agreement.escrowTransactions.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-semibold mb-2">Transaction History:</p>
                    <div className="space-y-2">
                      {agreement.escrowTransactions.map((tx, i) => (
                        <div key={i} className="text-xs bg-gray-50 p-2 rounded">
                          <p>
                            <span className="font-semibold capitalize">{tx.type}:</span>{' '}
                            {tx.status.toUpperCase()}
                          </p>
                          <p className="text-muted-foreground">{formatDate(tx.createdAt)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : isBuyer ? (
              <div>
                <p className="text-sm text-muted-foreground mb-4">Escrow not yet funded.</p>
                <button
                  onClick={handleFundEscrow}
                  disabled={fundingLoading}
                  className="bg-accent text-accent-foreground px-6 py-2 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50"
                >
                  {fundingLoading ? 'Funding...' : 'Fund Escrow (HTLC)'}
                </button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Awaiting buyer to fund escrow...</p>
            )}
          </div>

          {/* Milestones */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-bold mb-4">📋 Milestones</h2>
            {agreement.milestones.length === 0 ? (
              <p className="text-sm text-muted-foreground">No milestones yet.</p>
            ) : (
              <div className="space-y-3">
                {agreement.milestones.map((milestone) => (
                  <div key={milestone.id} className="border border-border p-4 rounded">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold">{milestone.title}</h3>
                      <span
                        className={`text-xs font-semibold px-2 py-1 rounded ${
                          milestone.status === 'approved'
                            ? 'bg-green-100 text-green-800'
                            : milestone.status === 'submitted'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {milestone.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">
                      Created: {formatDate(milestone.createdAt)}
                    </p>
                    {isSeller && milestone.status === 'pending' && (
                      <button className="text-sm bg-blue-100 text-blue-800 px-3 py-1 rounded hover:bg-blue-200">
                        Submit Work
                      </button>
                    )}
                    {isBuyer && milestone.status === 'submitted' && (
                      <button className="text-sm bg-green-100 text-green-800 px-3 py-1 rounded hover:bg-green-200">
                        Approve
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
              <h2 className="text-xl font-bold mb-4">⚠️ Risk Flags</h2>
              <ul className="space-y-2">
                {riskFlags.map((flag, i) => (
                  <li key={i} className="text-sm">
                    • {flag}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="font-bold mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <button className="w-full bg-blue-100 text-blue-800 px-4 py-2 rounded font-semibold text-sm hover:bg-blue-200">
                💬 Message
              </button>
              <button className="w-full bg-red-100 text-red-800 px-4 py-2 rounded font-semibold text-sm hover:bg-red-200">
                ⚠️ Dispute
              </button>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="font-bold mb-4">Recent Activity</h3>
            {agreement.messages.length === 0 ? (
              <p className="text-xs text-muted-foreground">No activity yet.</p>
            ) : (
              <div className="space-y-2">
                {agreement.messages.slice(0, 5).map((msg) => (
                  <div key={msg.id} className="text-xs border-l-2 border-border pl-2 py-1">
                    <p className="font-semibold">{msg.type === 'system' ? '🔔 System' : msg.sender?.displayName}</p>
                    <p className="text-muted-foreground truncate">{msg.content}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(msg.createdAt)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {error && <div className="mt-6 bg-red-50 border border-red-200 text-red-800 p-4 rounded">{error}</div>}
    </div>
  )
}
