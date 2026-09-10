// Who is allowed to mediate as a human.
//
// Platform mediators are named by wallet address in the environment, not by a
// flag in the database. Two reasons. The app already proves who someone is by
// their wallet, so a mediator needs no second kind of credential; and a role
// held in the database is a role that a database compromise can grant itself,
// whereas this one can only be changed by someone who can deploy.
//
// PLATFORM_ADMIN_ADDRESSES is a comma-separated list of Nimiq addresses. Unset
// means the platform has no human mediator, and every ruling route refuses —
// which is the right default for a deployment that has not thought about it.

const normalise = (a: string) => a.replace(/\s+/g, '').toUpperCase()

export function adminAddresses(): string[] {
  return (process.env.PLATFORM_ADMIN_ADDRESSES ?? '')
    .split(',')
    .map((a) => a.trim())
    .filter(Boolean)
    .map(normalise)
}

export function isPlatformAdmin(address: string | null | undefined): boolean {
  if (!address) return false
  const admins = adminAddresses()
  if (admins.length === 0) return false
  return admins.includes(normalise(address))
}

export function hasPlatformMediator(): boolean {
  return adminAddresses().length > 0
}
