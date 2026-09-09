'use client'

// The last resort: an error thrown in the root layout itself, before any of the
// app's styling exists. It has to render its own <html> and <body>, and cannot
// rely on Tailwind or any component, so the styles here are inline on purpose.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#08090a',
          color: '#e8e9ea',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          padding: '1rem',
        }}
      >
        <div style={{ maxWidth: '32rem' }}>
          <h1 style={{ fontSize: '15px', fontWeight: 500, margin: 0 }}>NimTrust failed to start</h1>
          <p style={{ fontSize: '14px', lineHeight: 1.6, color: '#8b8d90' }}>
            The application could not load. Your deals and escrow are stored server-side and are
            unaffected.
          </p>
          {process.env.NODE_ENV === 'development' && (
            <pre
              style={{
                fontSize: '12px',
                color: '#f87171',
                background: 'rgba(255,255,255,0.03)',
                padding: '0.75rem',
                borderRadius: '6px',
                overflow: 'auto',
              }}
            >
              {error.message}
            </pre>
          )}
          <button
            onClick={reset}
            style={{
              marginTop: '1rem',
              height: '36px',
              padding: '0 1rem',
              borderRadius: '6px',
              border: 'none',
              background: '#e4f222',
              color: '#08090a',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  )
}
