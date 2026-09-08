'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    // Check if user has a session, redirect accordingly
    const checkSession = async () => {
      const res = await fetch('/api/auth/session', { credentials: 'include' })
      if (res.ok) {
        router.push('/dashboard')
      } else {
        router.push('/login')
      }
    }
    checkSession()
  }, [router])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-muted-foreground">Loading...</p>
    </div>
  )
}
