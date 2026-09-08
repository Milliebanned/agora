'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { shortAddress, formatDate } from '@/lib/utils'

interface UserProfile {
  id: string
  address: string
  displayName: string
  bio?: string
  createdAt: string
  reputation: {
    trustScore: number
    totalAgreements: number
    completedAgreements: number
    avgDeliveryDays: number
    disputeRate: number
  }
  completedCount: number
}

export default function ProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const sessionRes = await fetch('/api/auth/session', { credentials: 'include' })

        if (!sessionRes.ok) {
          router.push('/login')
          return
        }

        const sessionData = await sessionRes.json()
        const res = await fetch(`/api/users/${sessionData.user.id}`, {
          credentials: 'include',
        })

        if (!res.ok) throw new Error('Failed to load profile')

        const data = await res.json()
        setProfile(data)
        setDisplayName(data.displayName)
        setBio(data.bio || '')
      } catch (err) {
        console.error('Failed to load profile:', err)
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [router])

  const handleSaveProfile = async () => {
    if (!profile) return

    try {
      const res = await fetch(`/api/users/${profile.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName, bio }),
        credentials: 'include',
      })

      if (res.ok) {
        setProfile({ ...profile, displayName, bio })
        setEditing(false)
      }
    } catch (err) {
      console.error('Failed to update profile:', err)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  if (!profile) {
    return <div className="flex items-center justify-center min-h-screen">Profile not found</div>
  }

  const completionRate =
    profile.reputation.totalAgreements > 0
      ? Math.round((profile.reputation.completedAgreements / profile.reputation.totalAgreements) * 100)
      : 0

  return (
    <div className="max-w-4xl mx-auto py-8">
      {/* Header Card */}
      <div className="bg-gradient-to-r from-accent to-accent/80 text-white p-8 rounded-lg mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold mb-2">{profile.displayName}</h1>
            <p className="text-white/80">{shortAddress(profile.address)}</p>
            <p className="text-sm text-white/60 mt-2">Joined {formatDate(profile.createdAt)}</p>
          </div>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded font-semibold text-sm"
            >
              Edit Profile
            </button>
          )}
        </div>
      </div>

      {/* Trust Score Big Card */}
      <div className="bg-white p-8 rounded-lg shadow mb-8">
        <div className="text-center mb-8">
          <p className="text-muted-foreground mb-2">Trust Score</p>
          <p className="text-6xl font-bold text-accent">{profile.reputation.trustScore}</p>
          <p className="text-muted-foreground mt-2">out of 100</p>
        </div>

        <div className="grid grid-cols-4 gap-6">
          <div className="text-center">
            <p className="text-2xl font-bold">{profile.reputation.totalAgreements}</p>
            <p className="text-sm text-muted-foreground">Total Agreements</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{completionRate}%</p>
            <p className="text-sm text-muted-foreground">Completion Rate</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{profile.reputation.disputeRate.toFixed(1)}%</p>
            <p className="text-sm text-muted-foreground">Dispute Rate</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{profile.reputation.avgDeliveryDays.toFixed(1)}</p>
            <p className="text-sm text-muted-foreground">Avg Delivery Days</p>
          </div>
        </div>
      </div>

      {/* Edit Form */}
      {editing && (
        <div className="bg-white p-8 rounded-lg shadow mb-8">
          <h2 className="text-2xl font-bold mb-6">Edit Profile</h2>

          <div className="mb-6">
            <label className="block mb-2 font-semibold">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full border border-border rounded-lg p-3"
            />
          </div>

          <div className="mb-6">
            <label className="block mb-2 font-semibold">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell others about yourself"
              className="w-full border border-border rounded-lg p-3"
              rows={4}
            />
          </div>

          <div className="flex gap-4">
            <button
              onClick={handleSaveProfile}
              className="bg-accent text-accent-foreground px-6 py-2 rounded-lg font-semibold hover:opacity-90"
            >
              Save Changes
            </button>
            <button
              onClick={() => {
                setEditing(false)
                setDisplayName(profile.displayName)
                setBio(profile.bio || '')
              }}
              className="bg-muted text-foreground px-6 py-2 rounded-lg font-semibold hover:opacity-90"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Bio */}
      {profile.bio && !editing && (
        <div className="bg-white p-8 rounded-lg shadow mb-8">
          <h2 className="text-xl font-bold mb-4">About</h2>
          <p className="text-gray-700">{profile.bio}</p>
        </div>
      )}

      {/* Stats */}
      <div className="bg-white p-8 rounded-lg shadow">
        <h2 className="text-xl font-bold mb-6">Reputation Details</h2>

        <div className="space-y-4">
          <div className="flex justify-between items-center pb-4 border-b">
            <span className="text-muted-foreground">Completed Agreements</span>
            <span className="font-bold text-lg">{profile.reputation.completedAgreements}</span>
          </div>

          <div className="flex justify-between items-center pb-4 border-b">
            <span className="text-muted-foreground">Completion Rate</span>
            <span className="font-bold text-lg">{completionRate}%</span>
          </div>

          <div className="flex justify-between items-center pb-4 border-b">
            <span className="text-muted-foreground">Avg Delivery Time</span>
            <span className="font-bold text-lg">{profile.reputation.avgDeliveryDays.toFixed(1)} days</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Dispute Rate</span>
            <span className="font-bold text-lg">{profile.reputation.disputeRate.toFixed(1)}%</span>
          </div>
        </div>
      </div>
    </div>
  )
}
