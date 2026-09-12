'use client'

import { useEffect, useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input, Textarea } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { PageHeader, StatTile, PageLoading } from '@/components/ui/page'
import { useToast } from '@/components/ui/toast'
import { useSession } from '@/components/SessionProvider'
import Avatar from '@/components/ui/avatar'
import AvatarUpload from '@/components/AvatarUpload'
import { ROLE_LABELS, ROLE_TAGLINES, roleLabel } from '@/lib/roles'
import { MESSAGES, FALLBACK_ERROR } from '@/lib/messages'
import type { UserRole } from '@/lib/types'

interface UserProfile {
  id: string
  address: string
  displayName: string
  bio?: string
  role?: UserRole | null
  avatarUpdatedAt?: string | null
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
  const [copied, setCopied] = useState(false)
  const router = useRouter()
  const toast = useToast()
  const { user, loading: sessionLoading, refresh } = useSession()
  const [ledger, setLedger] = useState<{
    freelancer: { claimed: number; mediated: number; awaitingClaim: number }
    client: { inEscrow: number; owedToFreelancers: number; paidOut: number; returned: number }
  } | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [saving, setSaving] = useState(false)
  const [switchingRole, setSwitchingRole] = useState(false)

  useEffect(() => {
    if (sessionLoading) return
    if (!user) {
      router.push('/')
      return
    }

    const load = async () => {
      try {
        fetch('/api/ledger', { credentials: 'include' })
          .then((r) => (r.ok ? r.json() : null))
          .then(setLedger)
          .catch(() => {})
        const res = await fetch(`/api/users/${user.id}`, { credentials: 'include' })
        if (!res.ok) throw new Error('Failed to load profile')
        const data = await res.json()
        setProfile(data)
        setDisplayName(data.displayName)
        setBio(data.bio || '')
      } catch (err) {
        console.error('Failed to load profile:', err)
        toast.error('Could not load your profile. Refresh to try again.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router, user, sessionLoading, toast])

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
      if (!res.ok) {
        const detail = (await res.json().catch(() => null))?.error
        toast.error(detail ?? FALLBACK_ERROR)
        return
      }
      setProfile({ ...profile, displayName, bio })
      setEditing(false)
      toast.success(MESSAGES.profileSaved)
    } catch (err) {
      console.error('Failed to update profile:', err)
      toast.error(FALLBACK_ERROR)
    } finally {
      setSaving(false)
    }
  }

  // Switching sides re-skins the whole dashboard. The write lands first, then
  // refresh() re-reads the session so the nav, the home screen and the board
  // all follow from one source — the UI never shows a side the server refused.
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
      if (!res.ok) {
        const detail = (await res.json().catch(() => null))?.error
        toast.error(detail ?? 'Could not switch sides. Nothing was changed — try again.')
        return
      }
      setProfile({ ...profile, role })
      await refresh()
      toast.success(MESSAGES.roleSwitched(ROLE_LABELS[role]))
    } catch (err) {
      console.error('Failed to switch role:', err)
      toast.error('Could not switch sides. Nothing was changed — try again.')
    } finally {
      setSwitchingRole(false)
    }
  }

  if (loading) return <PageLoading />
  if (!profile) return <PageLoading label="Profile not found" />

  const { reputation: rep } = profile
  const completionRate =
    rep.totalAgreements > 0 ? Math.round((rep.completedAgreements / rep.totalAgreements) * 100) : 0
  // Anything at all moved, on either side of the market.
  const hasMoney = Boolean(
    ledger &&
      (ledger.freelancer.claimed > 0 ||
        ledger.freelancer.mediated > 0 ||
        ledger.freelancer.awaitingClaim > 0 ||
        ledger.client.inEscrow > 0 ||
        ledger.client.paidOut > 0 ||
        ledger.client.returned > 0 ||
        ledger.client.owedToFreelancers > 0),
  )

  const score = Math.round(rep.trustScore)

  return (
    <>
      <PageHeader
        title="Profile"
        description="Your public identity and reputation on Agora."
        action={
          !editing && (
            <Button variant="secondary" onClick={() => setEditing(true)}>
              Edit profile
            </Button>
          )
        }
      />

      {/* The same arrangement a freelancer card uses on the directory: the
          picture first and largest, the name under it, and the standing that
          was earned under that. This is the page people are told their profile
          looks like, so it should look like the thing other people see. */}
      <Card>
        <div className="flex flex-col items-center px-6 py-8 text-center">
          <Avatar person={profile} size={96} className="ring-4 ring-accent/15" />

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
            <h2 className="text-[22px] font-medium tracking-heading">{profile.displayName}</h2>
            <Badge tone={profile.role ? 'accent' : 'neutral'}>{roleLabel(profile.role)}</Badge>
          </div>

          {/* Shown in full, not shortened. This is the address that identifies
              you to the platform, and a truncated one cannot be copied into
              anything that needs it. */}
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(profile.address)
              setCopied(true)
              setTimeout(() => setCopied(false), 1800)
            }}
            title="Copy your wallet address"
            className="group mt-1.5 flex max-w-full items-center justify-center gap-1.5 font-mono text-[12px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <span className="break-all">{profile.address}</span>
            {copied ? (
              <Check className="h-3 w-3 shrink-0 text-success" />
            ) : (
              <Copy className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
            )}
          </button>

          {profile.bio && !editing && (
            <p className="mt-3 max-w-md text-[14px] leading-relaxed text-muted-foreground">
              {profile.bio}
            </p>
          )}

          <div className="mt-5 flex w-full max-w-sm items-center justify-center gap-6">
            <div>
              <p className="text-[12px] text-muted-foreground">Trust score</p>
              <p
                className={`mt-0.5 text-[28px] font-medium leading-none tabular-nums ${scoreTone(score)}`}
              >
                {score}
              </p>
            </div>
            <span className="h-9 w-px bg-border" aria-hidden="true" />
            <div>
              <p className="text-[12px] text-muted-foreground">Completed</p>
              <p className="mt-0.5 text-[28px] font-medium leading-none tabular-nums text-foreground">
                {profile.reputation.completedAgreements}
              </p>
            </div>
            <span className="h-9 w-px bg-border" aria-hidden="true" />
            <div>
              <p className="text-[12px] text-muted-foreground">Joined</p>
              <p className="mt-1 text-[13px] leading-none text-secondary-foreground">
                {new Date(profile.createdAt).toLocaleDateString(undefined, {
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            </div>
          </div>

          <div className="mt-4 h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-elevate-strong">
            <div
              className={`h-full rounded-full ${score >= 75 ? 'bg-success' : score >= 45 ? 'bg-accent' : 'bg-destructive'}`}
              style={{ width: `${score}%` }}
            />
          </div>
        </div>
      </Card>

      {editing && (
        <Card className="mt-3">
          <div className="space-y-5 p-6">
            {/* The picture saves on its own, the moment it is picked, rather
                than waiting on the Save button below. There is nothing to
                validate about it and nothing else on the form it depends on,
                and seeing it land is the confirmation. */}
            <div>
              <p className="mb-2.5 text-[13px] font-medium text-secondary-foreground">
                Profile picture
              </p>
              <AvatarUpload
                person={profile}
                onChange={(avatarUpdatedAt) => {
                  setProfile({ ...profile, avatarUpdatedAt })
                  // The sidebar reads the session, not this page.
                  refresh()
                }}
              />
            </div>

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

      {/* Both halves of this are conditional on there being something to say,
          so the heading has to be too. A brand new account was getting a
          "Money" heading with an empty space under it. */}
      {ledger && hasMoney && (
        <div className="mt-8">
          <h2 className="mb-1 text-[15px] font-medium tracking-body">Money</h2>
          <p className="mb-4 text-[13px] text-muted-foreground">
            Counted from the payments themselves, not from how far along a deal is.
          </p>

          {(ledger.freelancer.claimed > 0 ||
            ledger.freelancer.mediated > 0 ||
            ledger.freelancer.awaitingClaim > 0) && (
            <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-3">
              <StatTile
                label="Claimed"
                value={ledger.freelancer.claimed.toFixed(2)}
                hint="NIM you collected"
              />
              <StatTile
                label="After mediation"
                value={ledger.freelancer.mediated.toFixed(2)}
                hint="NIM from settled disputes"
              />
              <StatTile
                label="Waiting to claim"
                value={ledger.freelancer.awaitingClaim.toFixed(2)}
                hint="NIM approved, still in escrow"
                accent={ledger.freelancer.awaitingClaim > 0}
              />
            </div>
          )}

          {(ledger.client.inEscrow > 0 ||
            ledger.client.paidOut > 0 ||
            ledger.client.returned > 0 ||
            ledger.client.owedToFreelancers > 0) && (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile
                label="In escrow"
                value={ledger.client.inEscrow.toFixed(2)}
                hint="NIM of yours being held"
                accent={ledger.client.inEscrow > 0}
              />
              <StatTile
                label="Awaiting collection"
                value={ledger.client.owedToFreelancers.toFixed(2)}
                hint="NIM approved, not yet claimed"
              />
              <StatTile
                label="Paid to freelancers"
                value={ledger.client.paidOut.toFixed(2)}
                hint="NIM released for work done"
              />
              <StatTile
                label="Returned to you"
                value={ledger.client.returned.toFixed(2)}
                hint="NIM from withdrawals and refunds"
              />
            </div>
          )}
        </div>
      )}

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
