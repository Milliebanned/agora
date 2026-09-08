'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface DashboardData {
  activeCount: number
  pendingCount: number
  disputedCount: number
  escrowBalance: number
  trustScore: number
}

export default function DashboardPage() {
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const sessionRes = await fetch('/api/auth/session', { credentials: 'include' })
        if (!sessionRes.ok) {
          router.push('/login')
          return
        }

        const sessionData = await sessionRes.json()

        // Fetch agreements
        const agreementsRes = await fetch('/api/agreements', { credentials: 'include' })
        const agreements = agreementsRes.ok ? await agreementsRes.json() : []

        // Fetch user profile with reputation
        const profileRes = await fetch(`/api/users/${sessionData.user.id}`, {
          credentials: 'include',
        })
        const profile = profileRes.ok ? await profileRes.json() : null

        const activeCount = agreements.filter((a: any) => a.status === 'active').length
        const pendingCount = agreements.filter((a: any) => a.status === 'draft').length
        const disputedCount = agreements.filter((a: any) => a.status === 'disputed').length

        // Calculate escrow balance (total locked in active agreements)
        const escrowBalance = agreements
          .filter((a: any) => a.status === 'active' && a.htlcAddress)
          .reduce((sum: number, a: any) => sum + a.amountNIM, 0)

        setData({
          activeCount,
          pendingCount,
          disputedCount,
          escrowBalance,
          trustScore: profile?.reputation?.trustScore || 50,
        })
      } catch (err) {
        console.error('Failed to load dashboard:', err)
      } finally {
        setLoading(false)
      }
    }

    loadDashboard()
  }, [router])

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  if (!data) {
    return <div className="flex items-center justify-center min-h-screen">Error loading dashboard</div>
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto p-8">
        <h1 className="text-4xl font-bold mb-8">Dashboard</h1>

        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <p className="text-muted-foreground text-sm mb-1">Active Agreements</p>
            <p className="text-3xl font-bold">{data.activeCount}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <p className="text-muted-foreground text-sm mb-1">Pending</p>
            <p className="text-3xl font-bold">{data.pendingCount}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <p className="text-muted-foreground text-sm mb-1">Escrow Balance</p>
            <p className="text-3xl font-bold">{data.escrowBalance} NIM</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <p className="text-muted-foreground text-sm mb-1">Trust Score</p>
            <p className="text-3xl font-bold">{data.trustScore}/100</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4 mb-8">
          <button className="bg-accent text-accent-foreground px-6 py-2 rounded-lg font-semibold hover:opacity-90">
            Create Agreement
          </button>
          <button className="bg-card border border-border text-foreground px-6 py-2 rounded-lg font-semibold hover:bg-muted">
            View Agreements
          </button>
        </div>

        {/* Upcoming Features Placeholder */}
        <div className="bg-white p-8 rounded-lg shadow text-center">
          <p className="text-muted-foreground mb-4">
            More features coming soon: disputes, reputation, AI assistant
          </p>
          <p className="text-sm text-muted-foreground">See /dashboard/agreements to explore</p>
        </div>
      </div>
    </div>
  )
}
