import type { UserRole } from './types'

// One place for the marketplace-side vocabulary, so the onboarding screen,
// dashboard, and profile all say the same thing.
export const ROLE_LABELS: Record<UserRole, string> = {
  provider: 'Service provider',
  client: 'Service seeker',
}

export const ROLE_TAGLINES: Record<UserRole, string> = {
  provider: 'You offer services — deliver work, claim escrow on approval.',
  client: 'You require services — fund escrow, approve work, release payment.',
}

export function roleLabel(role?: string | null): string {
  return role && role in ROLE_LABELS ? ROLE_LABELS[role as UserRole] : 'Unassigned'
}
