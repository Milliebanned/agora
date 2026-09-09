'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { shortAddress, formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input, Textarea } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { PageHeader, StatTile, PageLoading } from '@/components/ui/page'
import { ROLE_LABELS, ROLE_TAGLINES, roleLabel } from '@/lib/roles'
import type { UserRole } from '@/lib/types'

interface UserProfile {
  id: string
  address: string
  displayName: string
  bio?: string
  role?: UserRole | null
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

function scoreTone(score: number) {
  if (score >= 75) return 'text-success'
  if (score >= 45) return 'text-accent'
  return 'text-destructive'
}

export default function ProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [saving, setSaving] = useState(false)
  const [switchingRole, setSwitchingRole] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const sessionRes = await fetch('/api/auth/session', { credentials: 'include' })
        if (!sessionRes.ok) {
          router.push('/')
          return
        }
        const session = await sessionRes.json()
        const res = await fetch(`/api/users/${session.user.id}`, { credentials: 'include' })
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
    load()
  }, [router])

  const handleSave = async () => {
    if (!profile) return
    setSaving(true)
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
    } finally {
      setSaving(false)
    }
  }

  const switchRole = async (role: UserRole) => {
    if (!profile || profile.role === role) return
    setSwitchingRole(true)
    try {
      const res = await fetch('/api/auth/role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
        credentials: 'include',
      })
      if (res.ok) setProfile({ ...profile, role })
    } catch (err) {
      console.error('Failed to switch role:', err)
    } finally {
      setSwitchingRole(false)
    }
  }

  if (loading) return <PageLoading />
  if (!profile) return <PageLoading label="Profile not found" />

  const { reputation: rep } = profile
  const completionRate =
    rep.totalAgreements > 0 ? Math.round((rep.completedAgreements / rep.totalAgreements) * 100) : 0
  const score = Math.round(rep.trustScore)

  return (
    <>
      <PageHeader
        title="Profile"
        description="Your public identity and reputation on NimTrust."
        action={
          !editing && (
            <Button variant="secondary" onClick={() => setEditing(true)}>
              Edit profile
            </Button>
          )
        }
      />

      <Card>
        <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.06] text-[18px] font-medium">
              {profile.displayName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-[20px] font-medium tracking-heading">{profile.displayName}</h2>
                <Badge tone={profile.role ? 'accent' : 'neutral'}>{roleLabel(profile.role)}</Badge>
              </div>
              <p className="mt-0.5 font-mono text-[13px] text-muted-foreground">
                {shortAddress(profile.address)}
              </p>
              <p className="mt-0.5 text-[12px] text-subtle-foreground">
                Joined {formatDate(profile.createdAt)}
              </p>
            </div>
          </div>

          <div className="text-left sm:text-right">
            <p className="text-[13px] text-muted-foreground">Trust score</p>
            <p className={`text-[40px] font-medium leading-none tabular-nums ${scoreTone(score)}`}>
              {score}
            </p>
            <div className="mt-2 h-1 w-full min-w-[140px] overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className={`h-full rounded-full ${score >= 75 ? 'bg-success' : score >= 45 ? 'bg-accent' : 'bg-destructive'}`}
                style={{ width: `${score}%` }}
              />
            </div>
          </div>
        </div>
      </Card>

      {editing && (
        <Card className="mt-3">
          <div className="space-y-4 p-6">
            <div>
              <label className="text-[13px] font-medium text-secondary-foreground">
                Display name
              </label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="mt-2"
              />
            </div>
            <div>
              <label className="text-[13px] font-medium text-secondary-foreground">Bio</label>
              <Textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="What do you do, and what should counterparties know?"
                rows={4}
                className="mt-2"
              />
            </div>
            <div className="flex gap-2.5 pt-1">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving' : 'Save changes'}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setEditing(false)
                  setDisplayName(profile.displayName)
                  setBio(profile.bio || '')
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      {profile.bio && !editing && (
        <Card className="mt-3">
          <div className="p-6">
            <p className="mb-2 text-[13px] font-medium text-secondary-foreground">About</p>
            <p className="text-[14px] leading-relaxed text-muted-foreground">{profile.bio}</p>
          </div>
        </Card>
      )}

      <Card className="mt-3">
        <div className="p-6">
          <p className="text-[13px] font-medium text-secondary-foreground">Marketplace side</p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {profile.role
              ? ROLE_TAGLINES[profile.role]
              : 'Pick the side you are on to tailor your dashboard.'}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {(Object.keys(ROLE_LABELS) as UserRole[]).map((role) => (
              <Button
                key={role}
                variant={profile.role === role ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => switchRole(role)}
                disabled={switchingRole}
              >
                {ROLE_LABELS[role]}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      <div className="mt-8">
        <h2 className="mb-4 text-[15px] font-medium tracking-body">Reputation</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="Agreements" value={rep.totalAgreements} />
          <StatTile label="Completed" value={rep.completedAgreements} />
          <StatTile label="Completion rate" value={`${completionRate}%`} />
          <StatTile
            label="Dispute rate"
            value={`${rep.disputeRate.toFixed(1)}%`}
            hint={`avg ${rep.avgDeliveryDays.toFixed(1)}d delivery`}
          />
        </div>
      </div>
    </>
  )
}
