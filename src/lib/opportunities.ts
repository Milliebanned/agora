// The marketplace vocabulary: categories, lifecycle statuses, escrow stages,
// and the small parsers the board and its API share.
//
// Opportunities replaced the AI-drafted agreement flow. A client fills in
// structured fields, commits the budget, and the posting goes on the public
// board; freelancers pitch; the escrow locks on-chain when one is accepted.

export interface CategoryDef {
  id: string
  label: string
  services: string[]
}

export const CATEGORIES: CategoryDef[] = [
  {
    id: 'design',
    label: 'Design & creative',
    services: [
      'Landing page design',
      'Brand identity',
      'Product / UI design',
      'Illustration',
      'Motion graphics',
    ],
  },
  {
    id: 'development',
    label: 'Development',
    services: [
      'Web app',
      'Smart contract',
      'Mobile app',
      'API integration',
      'Bug fix or code review',
    ],
  },
  {
    id: 'writing',
    label: 'Writing & translation',
    services: ['Technical writing', 'Copywriting', 'Translation', 'Documentation'],
  },
  {
    id: 'marketing',
    label: 'Marketing & growth',
    services: ['Social campaign', 'SEO', 'Community management', 'Paid acquisition'],
  },
  {
    id: 'media',
    label: 'Video & audio',
    services: ['Video editing', 'Voice over', 'Podcast production', 'Sound design'],
  },
  {
    id: 'other',
    label: 'Other',
    services: ['Consulting', 'Research', 'Data work', 'Custom request'],
  },
]

export function categoryLabel(id?: string | null): string {
  return CATEGORIES.find((c) => c.id === id)?.label ?? 'Uncategorised'
}

export function isValidCategory(id: unknown): id is string {
  return typeof id === 'string' && CATEGORIES.some((c) => c.id === id)
}

// Budget brackets used by the board filter. `max: null` means "and up".
export const BUDGET_BANDS = [
  { id: 'any', label: 'Any budget', min: null as number | null, max: null as number | null },
  { id: 'under-250', label: 'Under 250', min: null, max: 250 },
  { id: '250-1000', label: '250 – 1,000', min: 250, max: 1000 },
  { id: '1000-5000', label: '1,000 – 5,000', min: 1000, max: 5000 },
  { id: 'over-5000', label: 'Over 5,000', min: 5000, max: null },
]

// Timeline brackets, in the working days the client asked for.
export const TIMELINE_BANDS = [
  { id: 'any', label: 'Any timeline', maxDays: null as number | null },
  { id: 'week', label: 'Within a week', maxDays: 7 },
  { id: 'fortnight', label: 'Within 2 weeks', maxDays: 14 },
  { id: 'month', label: 'Within a month', maxDays: 30 },
]

export const SORTS = [
  { id: 'newest', label: 'Newest' },
  { id: 'budget_high', label: 'Highest budget' },
  { id: 'budget_low', label: 'Lowest budget' },
  { id: 'timeline_short', label: 'Fastest turnaround' },
]

export type SortId = 'newest' | 'budget_high' | 'budget_low' | 'timeline_short'

export function sortOrderBy(sort: string | null) {
  switch (sort) {
    case 'budget_high':
      return { amountNIM: 'desc' as const }
    case 'budget_low':
      return { amountNIM: 'asc' as const }
    case 'timeline_short':
      return { timelineDays: 'asc' as const }
    default:
      return { publishedAt: 'desc' as const }
  }
}

// Where the money actually is, derived from the escrow columns rather than
// stored separately so the record can never disagree with itself.
//
//   unfunded  nothing paid — the posting is still a draft, invisible to anyone
//   held      the client's payment is confirmed on-chain in the Agora escrow
//             account. Real NIM has left their wallet.
//   assigned  a freelancer is engaged and the held funds are earmarked for them
//   released  the client approved and the funds were paid out to the freelancer
//   refunded  returned to the client
//   split     a mediated verdict both parties accepted divided the escrow
export type EscrowStage = 'unfunded' | 'held' | 'assigned' | 'released' | 'refunded' | 'split'

export function escrowStage(a: {
  status: string
  htlcHashRoot?: string | null
  htlcAddress?: string | null
}): EscrowStage {
  if (a.status === 'completed') return 'released'
  if (a.status === 'settled') return 'split'
  if (a.status === 'cancelled' || a.status === 'refunded') return 'refunded'
  // htlcAddress carries the on-chain funding transaction of the escrow payment.
  if (a.status === 'locked' || a.status === 'submitted' || a.status === 'disputed')
    return 'assigned'
  if (a.htlcHashRoot) return 'held'
  return 'unfunded'
}

export const ESCROW_STAGE_COPY: Record<EscrowStage, { label: string; detail: string }> = {
  unfunded: {
    label: 'Not funded',
    detail:
      'The client has not paid the budget into escrow yet, so this posting is not public. Publishing it moves real NIM out of their wallet.',
  },
  held: {
    label: 'Held in escrow',
    detail:
      'The budget has left the client’s wallet and is confirmed on-chain in the Agora escrow account. A freelancer can see the money exists before writing a word.',
  },
  assigned: {
    label: 'Earmarked',
    detail:
      'A freelancer is engaged and the escrowed funds are committed to this deal. They pay out when the client approves the work.',
  },
  released: {
    label: 'Released',
    detail: 'The client approved the work and the escrow was paid out to the freelancer.',
  },
  refunded: {
    label: 'Refunded',
    detail: 'The escrow returned to the client.',
  },
  split: {
    label: 'Split by mediation',
    detail:
      'Both parties accepted the mediator’s verdict and the escrow was divided between them on-chain.',
  },
}

export interface Attachment {
  label: string
  url: string
}

const MAX_ATTACHMENTS = 6

// Attachments are links, not uploads — there is no file store in this build,
// and a link to the brief the client already has is worth more than a copy.
export function parseAttachments(raw: string | null | undefined): Attachment[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((a) => a && typeof a.url === 'string')
      .map((a) => ({ label: String(a.label || a.url).slice(0, 80), url: String(a.url) }))
      .slice(0, MAX_ATTACHMENTS)
  } catch {
    return []
  }
}

// Rejects anything that is not a plain http(s) link, so a stored attachment can
// be rendered as an anchor without smuggling in a javascript: URL.
export function sanitizeAttachments(input: unknown): Attachment[] {
  if (!Array.isArray(input)) return []
  const out: Attachment[] = []
  for (const entry of input) {
    if (!entry || typeof entry !== 'object') continue
    const url = String((entry as Attachment).url ?? '').trim()
    if (!url) continue
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      continue
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') continue
    const label = String((entry as Attachment).label ?? '').trim() || parsed.hostname
    out.push({ label: label.slice(0, 80), url: parsed.toString().slice(0, 500) })
    if (out.length >= MAX_ATTACHMENTS) break
  }
  return out
}

export const MAX_DELIVERABLES = 10

export function sanitizeDeliverables(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  return input
    .map((d) => String(d ?? '').trim())
    .filter(Boolean)
    .map((d) => d.slice(0, 200))
    .slice(0, MAX_DELIVERABLES)
}

// Only these can be pitched for or negotiated; everything else is read-only.
export function isOpenForProposals(status: string): boolean {
  return status === 'open'
}

export function isEngaged(status: string): boolean {
  return status === 'locked' || status === 'submitted' || status === 'disputed'
}

// Links added when the work was handed in are stored on the posting alongside
// the brief's own attachments, marked by this prefix. They belong with the
// submitted work, not with the requirements — reading the brief should not mean
// scrolling past the delivery.
export const DELIVERED_PREFIX = 'Delivered: '

export function splitAttachments(all: Array<{ label: string; url: string }>) {
  const brief: Array<{ label: string; url: string }> = []
  const delivered: Array<{ label: string; url: string }> = []
  for (const a of all) {
    if (a.label.startsWith(DELIVERED_PREFIX)) {
      delivered.push({ ...a, label: a.label.slice(DELIVERED_PREFIX.length) })
    } else {
      brief.push(a)
    }
  }
  return { brief, delivered }
}
