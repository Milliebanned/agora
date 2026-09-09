import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken } from '@/lib/auth'
import prisma from '@/lib/db'
import type { UserRole } from '@/lib/types'

const ROLES: UserRole[] = ['provider', 'client']

// Sets the marketplace side the connected wallet is on. Called from
// /onboarding right after the first successful wallet connect, and from the
// profile page when someone switches sides.
export async function POST(request: NextRequest) {
  try {
    const session = request.cookies.get('session')?.value
    if (!session) {
      return NextResponse.json({ error: 'No session' }, { status: 401 })
    }

    const verified = await verifySessionToken(session)
    if (!verified) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    const { role } = await request.json()
    if (!ROLES.includes(role)) {
      return NextResponse.json(
        { error: `Role must be one of: ${ROLES.join(', ')}` },
        { status: 400 },
      )
    }

    const user = await prisma.user.update({
      where: { id: verified.userId },
      data: { role },
      select: { id: true, address: true, displayName: true, role: true },
    })

    return NextResponse.json({ user })
  } catch (error) {
    // Surfaced while the app is being debugged on-device, where the server
    // console is not reachable.
    console.error('Set role error:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: 'Failed to set role', detail: message }, { status: 500 })
  }
}
