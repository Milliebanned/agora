import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken } from '@/lib/auth'
import prisma from '@/lib/db'
import { isPlatformAdmin } from '@/lib/admin'

export async function GET(request: NextRequest) {
  try {
    const session = request.cookies.get('session')?.value

    if (!session) {
      return NextResponse.json({ error: 'No session' }, { status: 401 })
    }

    const verified = await verifySessionToken(session)
    if (!verified) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: verified.userId },
      select: { id: true, address: true, displayName: true, role: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Derived from the environment on every request rather than stored, so
    // revoking a mediator is a deploy and not a database edit that could be
    // missed.
    return NextResponse.json({ user: { ...user, isPlatformMediator: isPlatformAdmin(user.address) } })
  } catch (error) {
    console.error('Session check error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
