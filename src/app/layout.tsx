import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'NimTrust — P2P Trust & Escrow',
  description: 'AI-powered trust layer for peer-to-peer commerce on Nimiq',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground">
        {children}
      </body>
    </html>
  )
}
