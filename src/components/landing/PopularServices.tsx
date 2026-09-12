'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'

// The six things people actually come here to buy, drawn rather than
// photographed: the art is the same thin-line vocabulary as the globe and the
// figure in the features section, so a card reads as part of this product
// instead of stock imagery borrowed from another one.
//
// Categories and service names come from the real taxonomy in
// src/lib/opportunities.ts, so a card cannot advertise something the posting
// form cannot express.

interface Service {
  title: string
  category: string
  categoryId: string
  /** A green the art sits on. All in the same family, varied only enough to
   *  keep a row of six from reading as one long block. */
  tint: string
  art: ReactNode
}

const stroke = {
  fill: 'none',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export const SERVICES: Service[] = [
  {
    title: 'Brand identity',
    category: 'Design & creative',
    categoryId: 'design',
    tint: '#0e2014',
    art: (
      <svg viewBox="0 0 200 130" className="h-full w-full" aria-hidden="true">
        <circle cx="58" cy="52" r="21" stroke="#98fb98" strokeWidth="2" {...stroke} />
        <rect x="92" y="31" width="42" height="42" rx="8" stroke="#3bb143" strokeWidth="2" {...stroke} />
        <path d="M147 73 L168 31 L189 73 Z" stroke="#98fb98" strokeWidth="2" opacity="0.55" {...stroke} />
        <path d="M32 96 H168" stroke="#ffffff" strokeWidth="2" opacity="0.22" {...stroke} />
        <path d="M32 108 H120" stroke="#ffffff" strokeWidth="2" opacity="0.13" {...stroke} />
      </svg>
    ),
  },
  {
    title: 'Web app',
    category: 'Development',
    categoryId: 'development',
    tint: '#0c1d18',
    art: (
      <svg viewBox="0 0 200 130" className="h-full w-full" aria-hidden="true">
        <rect x="24" y="22" width="152" height="90" rx="9" stroke="#3bb143" strokeWidth="2" {...stroke} />
        <path d="M24 44 H176" stroke="#3bb143" strokeWidth="2" opacity="0.6" {...stroke} />
        <circle cx="38" cy="33" r="3" fill="#98fb98" />
        <circle cx="49" cy="33" r="3" fill="#98fb98" opacity="0.45" />
        <rect x="38" y="58" width="48" height="40" rx="5" stroke="#98fb98" strokeWidth="2" opacity="0.75" {...stroke} />
        <path d="M100 60 H162 M100 74 H146 M100 88 H156" stroke="#ffffff" strokeWidth="2" opacity="0.2" {...stroke} />
      </svg>
    ),
  },
  {
    title: 'Smart contract',
    category: 'Development',
    categoryId: 'development',
    tint: '#101f0d',
    art: (
      <svg viewBox="0 0 200 130" className="h-full w-full" aria-hidden="true">
        <path d="M62 18 H122 L146 42 V112 H62 Z" stroke="#3bb143" strokeWidth="2" {...stroke} />
        <path d="M122 18 V42 H146" stroke="#3bb143" strokeWidth="2" opacity="0.6" {...stroke} />
        <path d="M78 60 H130 M78 74 H118" stroke="#ffffff" strokeWidth="2" opacity="0.2" {...stroke} />
        <circle cx="104" cy="94" r="13" stroke="#98fb98" strokeWidth="2" {...stroke} />
        <path d="M99 94 l4 4 l7 -8" stroke="#98fb98" strokeWidth="2" {...stroke} />
      </svg>
    ),
  },
  {
    title: 'Video editing',
    category: 'Video & audio',
    categoryId: 'media',
    tint: '#0b1f1a',
    art: (
      <svg viewBox="0 0 200 130" className="h-full w-full" aria-hidden="true">
        <rect x="26" y="24" width="148" height="52" rx="7" stroke="#3bb143" strokeWidth="2" {...stroke} />
        <path d="M92 40 L112 50 L92 60 Z" fill="#98fb98" opacity="0.85" />
        <rect x="26" y="90" width="40" height="18" rx="4" stroke="#98fb98" strokeWidth="2" opacity="0.7" {...stroke} />
        <rect x="72" y="90" width="58" height="18" rx="4" stroke="#98fb98" strokeWidth="2" opacity="0.45" {...stroke} />
        <rect x="136" y="90" width="38" height="18" rx="4" stroke="#98fb98" strokeWidth="2" opacity="0.3" {...stroke} />
        <path d="M84 84 V114" stroke="#ffffff" strokeWidth="2" opacity="0.5" {...stroke} />
      </svg>
    ),
  },
  {
    title: 'Technical writing',
    category: 'Writing & translation',
    categoryId: 'writing',
    tint: '#0d1e11',
    art: (
      <svg viewBox="0 0 200 130" className="h-full w-full" aria-hidden="true">
        <rect x="48" y="18" width="104" height="94" rx="8" stroke="#3bb143" strokeWidth="2" {...stroke} />
        <path d="M66 42 H124" stroke="#98fb98" strokeWidth="3" {...stroke} />
        <path d="M66 60 H134 M66 72 H134 M66 84 H110" stroke="#ffffff" strokeWidth="2" opacity="0.2" {...stroke} />
        <path d="M126 96 l22 -22 l10 10 l-22 22 h-10 z" stroke="#98fb98" strokeWidth="2" {...stroke} />
      </svg>
    ),
  },
  {
    title: 'Social campaign',
    category: 'Marketing & growth',
    categoryId: 'marketing',
    tint: '#0f1f0e',
    art: (
      <svg viewBox="0 0 200 130" className="h-full w-full" aria-hidden="true">
        <rect x="62" y="16" width="76" height="98" rx="11" stroke="#3bb143" strokeWidth="2" {...stroke} />
        <path d="M78 92 L92 70 L108 82 L126 46" stroke="#98fb98" strokeWidth="2.5" {...stroke} />
        <circle cx="126" cy="46" r="4" fill="#98fb98" />
        <path d="M118 46 H130 M124 40 V52" stroke="#98fb98" strokeWidth="0" {...stroke} />
        <path d="M78 34 H108" stroke="#ffffff" strokeWidth="2" opacity="0.2" {...stroke} />
      </svg>
    ),
  },
]

export default function PopularServices({
  signedIn,
  onConnect,
  connecting,
}: {
  signedIn: boolean
  onConnect: () => void
  connecting: boolean
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {SERVICES.map((service) => {
        const body = (
          <>
            <div className="px-3.5 pb-3 pt-3.5">
              <p className="text-[14px] font-medium leading-snug tracking-body text-foreground">
                {service.title}
              </p>
              <p className="mt-1 text-[11.5px] text-muted-foreground">{service.category}</p>
            </div>
            <div
              className="mx-2 mb-2 overflow-hidden rounded-md"
              style={{ background: service.tint }}
            >
              <div className="aspect-[200/130] w-full">{service.art}</div>
            </div>
          </>
        )

        const className =
          'flex flex-col overflow-hidden rounded-lg border border-border bg-card text-left transition-colors hover:border-[#3bb143]'

        // Browsing is behind the wallet, so before there is one these ask for
        // it rather than leading somewhere that would send them straight back.
        return signedIn ? (
          <Link
            key={service.title}
            href={`/dashboard/workers?category=${service.categoryId}`}
            className={className}
          >
            {body}
          </Link>
        ) : (
          <button
            key={service.title}
            type="button"
            onClick={onConnect}
            disabled={connecting}
            className={`${className} disabled:opacity-60`}
          >
            {body}
          </button>
        )
      })}
    </div>
  )
}
