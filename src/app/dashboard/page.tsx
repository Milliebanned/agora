'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Compass } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader, PageLoading } from '@/components/ui/page'
import { useSession } from '@/components/SessionProvider'
import FreelancerHome from '@/components/dashboard/FreelancerHome'
import ClientHome from '@/components/dashboard/ClientHome'
import { ROLE_TAGLINES, primaryActionForRole } from '@/lib/roles'

export interface DashboardDeal {
  id: string
  title: string
  status: string
  amountNIM: string | number
  deadline: string
  buyerId: string
  sellerId?: string | null
  htlcHashRoot?: string | null
  htlcAddress?: string | null
}

// The shell: it loads what both sides need, then hands off to the view for the
// side this user is on. Each home is its own component, so switching sides
// swaps the whole screen rather than patching one in place.
export default function DashboardPage() {
  const router = useRouter()
  const { user, role, loading: sessionLoading } = useSession()
  const [deals, setDeals] = useState<DashboardDeal[]>([])
  const [trustScore, setTrustScore] = useState(50)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (sessionLoading) return
    if (!user) {
      router.push('/')
      return
    }

    const load = async () => {
      try {
        const [dealsRes, profileRes] = await Promise.all([
          fetch('/api/agreements', { credentials: 'include' }),
          fetch(`/api/users/${user.id}`, { credentials: 'include' }),
        ])
        if (dealsRes.ok) setDeals(await dealsRes.json())
        if (profileRes.ok) {
          const profile = await profileRes.json()
          setTrustScore(profile?.reputation?.trustScore ?? 50)
        }
      } catch (err) {
        console.error('Failed to load dashboard:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router, user, sessionLoading])

  if (sessionLoading || loading) return <PageLoading />

  const primary = primaryActionForRole(role)
  const PrimaryIcon = primary.icon

  return (
    <>
      <PageHeader
        title={role === 'provider' ? 'Find your next job' : 'Hire with confidence'}
        description={
          role ? ROLE_TAGLINES[role] : 'Your active deals, escrow, and standing at a glance.'
        }
        action={
          <div className="flex gap-2">
            {role === 'provider' ? (
              <Link href="/dashboard/applications">
                <Button variant="secondary">Applications</Button>
              </Link>
            ) : (
              <Link href="/dashboard/workers">
                <Button variant="secondary">
                  <Compass className="h-4 w-4" />
                  Find workers
                </Button>
              </Link>
            )}
            <Link href={primary.href}>
              <Button>
                <PrimaryIcon className="h-4 w-4" strokeWidth={2.5} />
                {primary.label}
              </Button>
            </Link>
          </div>
        }
      />

      {role === 'provider' ? (
        <FreelancerHome deals={deals} meId={user?.id ?? null} trustScore={trustScore} />
      ) : (
        <ClientHome deals={deals} meId={user?.id ?? null} trustScore={trustScore} />
      )}
    </>
  )
}
