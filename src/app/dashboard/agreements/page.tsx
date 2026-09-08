'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Agreement {
  id: string
  title: string
  status: string
  amountNIM: number
  deadline: string
  buyerId: string
  sellerId: string | null
  buyer: { displayName: string }
  seller?: { displayName: string }
}

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  active: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  disputed: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-800',
}

export default function AgreementsPage() {
  const router = useRouter()
  const [agreements, setAgreements] = useState<Agreement[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    const loadAgreements = async () => {
      try {
        const res = await fetch(
          filter === 'all'
            ? '/api/agreements'
            : `/api/agreements?status=${filter}`,
          { credentials: 'include' },
        )

        if (!res.ok) {
          router.push('/login')
          return
        }

        const data = await res.json()
        setAgreements(data)
      } catch (err) {
        console.error('Failed to load agreements:', err)
      } finally {
        setLoading(false)
      }
    }

    loadAgreements()
  }, [filter, router])

  const statusOptions = ['all', 'draft', 'active', 'completed', 'disputed']

  return (
    <div className="max-w-6xl mx-auto py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Agreements</h1>
        <Link href="/dashboard/agreements/create">
          <button className="bg-accent text-accent-foreground px-6 py-2 rounded-lg font-semibold hover:opacity-90">
            Create Agreement
          </button>
        </Link>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-6">
        {statusOptions.map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              filter === status
                ? 'bg-accent text-accent-foreground'
                : 'bg-muted text-foreground hover:bg-gray-200'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : agreements.length === 0 ? (
        <div className="bg-white p-8 rounded-lg shadow text-center">
          <p className="text-muted-foreground mb-4">No agreements yet</p>
          <Link href="/dashboard/agreements/create">
            <button className="bg-accent text-accent-foreground px-6 py-2 rounded-lg font-semibold hover:opacity-90">
              Create Your First Agreement
            </button>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {agreements.map((agreement) => (
            <Link key={agreement.id} href={`/dashboard/agreements/${agreement.id}`}>
              <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold">{agreement.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {agreement.buyerId !== agreement.sellerId
                        ? agreement.sellerId
                          ? `with ${agreement.seller?.displayName || 'Pending'}`
                          : 'Awaiting seller'
                        : 'Self-signed'}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      statusColors[agreement.status]
                    }`}
                  >
                    {agreement.status.charAt(0).toUpperCase() + agreement.status.slice(1)}
                  </span>
                </div>

                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-sm text-muted-foreground">Amount</p>
                    <p className="text-xl font-bold">{agreement.amountNIM} NIM</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Deadline</p>
                    <p className="text-sm font-semibold">
                      {new Date(agreement.deadline).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
