import { NextResponse } from 'next/server'

// Is this deployment the code I think it is, and can it see the configuration
// I think it can?
//
// Unauthenticated on purpose: the admin health check needs a shared secret,
// and a secret that does not match is indistinguishable from a variable that
// is not set — which is exactly the confusion this exists to end. So it
// reports only facts that are useless to an attacker: whether a variable is
// non-empty, never its value, and the commit the build came from.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Read indirectly so the bundler cannot fold these into build-time literals.
// A value inlined at build time is precisely the failure mode being diagnosed:
// it would report what was true when the bundle was made rather than what the
// running function can actually see.
function envIsSet(name: string): boolean {
  const env = process.env as Record<string, string | undefined>
  return Boolean(env[name] && env[name]!.trim().length > 0)
}

function envCount(name: string): number {
  const env = process.env as Record<string, string | undefined>
  return (env[name] ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean).length
}

export async function GET() {
  return NextResponse.json({
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'unknown (not a Vercel build)',
    branch: process.env.VERCEL_GIT_COMMIT_REF ?? 'unknown',
    environment: process.env.VERCEL_ENV ?? 'local',
    // Names only, never values.
    config: {
      PLATFORM_ADMIN_ADDRESSES: {
        set: envIsSet('PLATFORM_ADMIN_ADDRESSES'),
        count: envCount('PLATFORM_ADMIN_ADDRESSES'),
      },
      NIMIQ_NETWORK: { set: envIsSet('NIMIQ_NETWORK') },
      NEXT_PUBLIC_NIMIQ_NETWORK: { set: envIsSet('NEXT_PUBLIC_NIMIQ_NETWORK') },
      NIMIQ_ESCROW_ADDRESS: { set: envIsSet('NIMIQ_ESCROW_ADDRESS') },
      NIMIQ_ESCROW_PRIVATE_KEY: { set: envIsSet('NIMIQ_ESCROW_PRIVATE_KEY') },
      GEMINI_API_KEY: { set: envIsSet('GEMINI_API_KEY') },
      DATABASE_URL: { set: envIsSet('DATABASE_URL') },
      ESCROW_ADMIN_TOKEN: { set: envIsSet('ESCROW_ADMIN_TOKEN') },
    },
    checkedAt: new Date().toISOString(),
  })
}
