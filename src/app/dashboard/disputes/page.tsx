'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'

interface Dispute {
  id: string
  status: string
  reason: string
  createdAt: string
  agreement: {
    id: string
    title: string
  }
  opener: {
    displayName: string
  }
  respondent: {
    displayName: string
  }
}

const statusColors: Record<string, string> = {
  open: 'bg-red-100 text-red-800',
  under_review: 'bg-yellow-100 text-yellow-800',
  resolved: 'bg-green-100 text-green-800',
}

export default function DisputesPage() {
  const router = useRouter()
  const [disputes, setDisputes] = useState<Dispute[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadDisputes = async () => {
      try {
        const res = await fetch('/api/disputes', { credentials: 'include' })

        if (!res.ok) {
          router.push('/login')
          return
        }

        const data = await res.json()
        setDisputes(data)
      } catch (err) {
        console.error('Failed to load disputes:', err)
      } finally {
        setLoading(false)
      }
    }

    loadDisputes()
  }, [router])

  return (
    <div className="max-w-6xl mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">Disputes</h1>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : disputes.length === 0 ? (
        <div className="bg-white p-8 rounded-lg shadow text-center">
          <p className="text-muted-foreground mb-4">No disputes yet</p>
          <p className="text-sm text-muted-foreground">
            Disputes are opened when agreement parties disagree. AI mediator reviews each case.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {disputes.map((dispute) => (
            <Link key={dispute.id} href={`/dashboard/disputes/${dispute.id}`}>
              <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold">{dispute.agreement.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{dispute.reason}</p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      statusColors[dispute.status]
                    }`}
                  >
                    {dispute.status.replace('_', ' ').toUpperCase()}
                  </span>
                </div>

                <div className="flex justify-between items-end text-sm">
                  <div>
                    <p className="text-muted-foreground">
                      {dispute.opener.displayName} vs {dispute.respondent.displayName}
                    </p>
                  </div>
                  <p className="text-muted-foreground text-xs">{formatDate(dispute.createdAt)}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
