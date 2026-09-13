import { NextRequest, NextResponse } from 'next/server'
import { signSessionToken } from '@/lib/auth'
import prisma from '@/lib/db'
import { consumeSignedAction } from '@/lib/action-signing'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const { address, nonce, signature, publicKey } = await request.json()

    if (!address || !nonce || !signature || !publicKey) {
      return NextResponse.json(
        { error: 'Address, nonce, signature and public key are all required.' },
        { status: 400 },
      )
    }

    // The real check. The nonce has to be one this server issued to this
    // address moments ago and has never spent, and the signature over it has
    // to come from a key that derives to that same address.
    const proven = await consumeSignedAction({
      proof: { nonce, signature, publicKey },
      address,
      action: 'login',
    })
    if (!proven.ok) {
      return NextResponse.json({ error: proven.error }, { status: proven.status })
    }

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { address },
    })

    if (!user) {
      user = await prisma.user.create({
        data: {
          address,
          displayName: `User ${address.substring(0, 8)}`,
        },
      })
    }

    // Generate session token
    const token = await signSessionToken(user.id, user.address)

    // Set session cookie
    const response = NextResponse.json({
      user: {
        id: user.id,
        address: user.address,
        displayName: user.displayName,
        // Null on a first connect — the client routes to /onboarding to pick a side.
        role: user.role,
      },
    })

    response.cookies.set('session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    })

    return response
  } catch (error) {
    // Detail is surfaced deliberately while the app is on testnet and being
    // debugged on-device, where the server console is not reachable.
    console.error('Verification error:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: 'Verification failed', detail: message }, { status: 500 })
  }
}
