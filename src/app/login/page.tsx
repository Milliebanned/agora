'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// The landing page lives at /. Kept so existing /login links still resolve.
export default function LoginRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/')
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/15 border-t-white/70" />
    </div>
  )
}
