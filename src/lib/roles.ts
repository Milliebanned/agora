import {
  Compass,
  FileText,
  Home,
  Megaphone,
  Plus,
  Scale,
  Send,
  User,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { UserRole } from './types'

// One place for the marketplace-side vocabulary and for what each side's
// dashboard leads with, so onboarding, the sidebar, the mobile tabs, the home
// screen and the board all say the same thing. Internal role values stay
// 'provider' | 'client'; only the words people read change here.
export const ROLE_LABELS: Record<UserRole, string> = {
  provider: 'Freelancer',
  client: 'Client',
}

export const ROLE_TAGLINES: Record<UserRole, string> = {
  provider: 'Find work worth doing. The budget is in escrow before you write a word.',
  client: 'Hire talent with confidence. Your budget stays in escrow until you approve the work.',
}

export function roleLabel(role?: string | null): string {
  return role && role in ROLE_LABELS ? ROLE_LABELS[role as UserRole] : 'Unassigned'
}

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
}

export interface PrimaryAction {
  href: string
  label: string
  /** The mobile top bar has room for about one word. */
  shortLabel: string
  icon: LucideIcon
}

const HOME: NavItem = { href: '/dashboard', label: 'Home', icon: Home }
const DEALS: NavItem = { href: '/dashboard/agreements', label: 'Deals', icon: FileText }
const DISPUTES: NavItem = { href: '/dashboard/disputes', label: 'Disputes', icon: Scale }
const PROFILE: NavItem = { href: '/dashboard/profile', label: 'Profile', icon: User }

// A freelancer browses work and advertises themselves; a client browses
// freelancers. Neither one has a tab for their own postings — those live under
// Deals, where the rest of a deal's life already is.
export const ROLE_NAV: Record<UserRole, NavItem[]> = {
  provider: [
    HOME,
    { href: '/dashboard/opportunities', label: 'Find work', icon: Compass },
    { href: '/dashboard/advertisements', label: 'My ads', icon: Megaphone },
    { href: '/dashboard/applications', label: 'Applications', icon: Send },
    DEALS,
    DISPUTES,
    PROFILE,
  ],
  client: [
    HOME,
    { href: '/dashboard/workers', label: 'Find workers', icon: Users },
    DEALS,
    DISPUTES,
    PROFILE,
  ],
}

// Someone with no side picked yet — in practice a platform mediator, who is
// neither buyer nor seller — still needs to move around.
const NEUTRAL_NAV: NavItem[] = [
  HOME,
  { href: '/dashboard/opportunities', label: 'Opportunities', icon: Compass },
  DEALS,
  DISPUTES,
  PROFILE,
]

export function navForRole(role?: UserRole | null): NavItem[] {
  return role ? ROLE_NAV[role] : NEUTRAL_NAV
}

// What the green button does. A freelancer's main move is finding work; a
// client's is putting work up. Posting is only *demoted* for freelancers, never
// blocked: nothing server-side stops them, and the side is switchable.
export const ROLE_PRIMARY_ACTION: Record<UserRole, PrimaryAction> = {
  provider: {
    href: '/dashboard/opportunities',
    label: 'Find work',
    shortLabel: 'Find work',
    icon: Compass,
  },
  client: {
    href: '/dashboard/opportunities/new',
    label: 'Post job',
    shortLabel: 'New',
    icon: Plus,
  },
}

export function primaryActionForRole(role?: UserRole | null): PrimaryAction {
  return role ? ROLE_PRIMARY_ACTION[role] : ROLE_PRIMARY_ACTION.client
}

// Screen copy that differs by side. Kept beside the nav so a change of voice
// happens in one edit rather than five files.
export const ROLE_COPY = {
  provider: {
    boardTitle: 'Find work',
    boardDescription:
      'Every posting here has its budget committed to escrow already, so the money is there before you write a proposal.',
    boardEmptyTitle: 'Nothing matches those filters',
    boardEmptyBody: 'Widen the budget or timeline band and check back — new work is posted daily.',
    noDealsTitle: 'No work yet',
    noDealsBody:
      'Every posting on the board has its budget already committed to escrow, so the money is there before you write a proposal.',
  },
  client: {
    boardTitle: 'My postings',
    boardDescription: 'The work you have put up, and the proposals waiting on each one.',
    boardEmptyTitle: 'You have not posted anything yet',
    boardEmptyBody:
      'Describe the work you need, commit the budget to escrow, and pick from the proposals that come in.',
    noDealsTitle: 'No deals yet',
    noDealsBody:
      'Describe the work you need, commit the budget to escrow, and pick from the proposals that come in.',
  },
} as const satisfies Record<UserRole, Record<string, string>>

export function roleCopy(role?: UserRole | null) {
  return role ? ROLE_COPY[role] : ROLE_COPY.client
}
