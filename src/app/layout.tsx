import type { Metadata } from 'next'
import { Inter, JetBrains_Mono, Newsreader } from 'next/font/google'
import { THEME_SCRIPT } from '@/lib/theme'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

// The whitepaper's cover face. Used only where the page speaks in its own
// voice, which is the hero headline and nothing else.
const display = Newsreader({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['300', '400'],
  style: ['normal', 'italic'],
  display: 'swap',
})

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: '400',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Agora: P2P Trust & Escrow',
  description: 'AI-powered trust layer for peer-to-peer commerce on Nimiq',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${mono.variable} ${display.variable}`}
    >
      <head>
        {/* Before the first paint, so nobody watches the dashboard load dark
            and then turn light. See src/lib/theme.ts. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="bg-background text-foreground font-sans antialiased">{children}</body>
    </html>
  )
}
