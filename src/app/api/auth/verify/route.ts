import { NextRequest, NextResponse } from 'next/server'
import { signSessionToken, verifyWalletSignature } from '@/lib/auth'
import prisma from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const { address, message, signature } = await request.json()

    if (!address || !message || !signature) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    // Verify the signature
    const isValid = verifyWalletSignature(address, message, signature)
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
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
    console.error('Verification error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
