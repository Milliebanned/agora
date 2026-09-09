'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

// Without this, a thrown error in any route leaves Next with nothing to render
// and it retries in a loop — the "missing required error components" message,
// which says nothing about what actually broke. This shows the error instead.
//
// In development it prints the message and stack, because that is what you need
// at 2am. In production it stays vague on screen: an error string can leak an
// address, a query, or a key name to whoever triggered it.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Route error:', error)
  }, [error])

  const isDev = process.env.NODE_ENV === 'development'

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <Card className="w-full max-w-lg">
        <div className="p-6">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <h1 className="text-[15px] font-medium tracking-body">Something broke</h1>
          </div>

          <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">
            This page failed to load. Nothing you were doing was lost — escrow and payments are
            recorded server-side, so a broken page never means a broken deal.
          </p>

          {isDev && (
            <pre className="mt-4 max-h-64 overflow-auto rounded-md bg-white/[0.03] p-3 text-[12px] leading-relaxed text-destructive">
              {error.message}
              {error.stack ? `\n\n${error.stack}` : ''}
            </pre>
          )}

          {error.digest && (
            <p className="mt-3 font-mono text-[12px] text-subtle-foreground">
              Reference: {error.digest}
            </p>
          )}

          <div className="mt-5 flex gap-2">
            <Button onClick={reset}>
              <RotateCw className="h-4 w-4" />
              Try again
            </Button>
            <Link href="/dashboard">
              <Button variant="secondary">Back to dashboard</Button>
            </Link>
          </div>
        </div>
      </Card>
    </div>
  )
}
