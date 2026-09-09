import { jwtVerify, SignJWT } from 'jose'
import type { NextRequest } from 'next/server'
import type { SessionJWT } from './types'

const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'dev-secret-key')

// Generate a message for wallet signing (authentication challenge)
export function generateChallenge(address: string): string {
  const timestamp = Date.now()
  return `Sign this message to authenticate:\nWallet: ${address}\nTimestamp: ${timestamp}`
}

// Sign a JWT session token
export async function signSessionToken(userId: string, address: string): Promise<string> {
  const token = await new SignJWT({
    userId,
    address,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret)

  return token
}

// Verify a JWT session token
export async function verifySessionToken(token: string): Promise<SessionJWT | null> {
  try {
    const verified = await jwtVerify(token, secret)
    return verified.payload as unknown as SessionJWT
  } catch (err) {
    console.error('JWT verification failed:', err)
    return null
  }
}

// Read and verify the session cookie in one step. Every API route opened with
// the same three lines before this existed.
export async function requireSession(request: NextRequest): Promise<SessionJWT | null> {
  const token = request.cookies.get('session')?.value
  if (!token) return null
  return verifySessionToken(token)
}

// Get session from request cookies
export function getSessionFromRequest(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie')
  if (!cookieHeader) return null

  const cookies = cookieHeader.split('; ').reduce(
    (acc: Record<string, string>, cookie: string) => {
      const [key, value] = cookie.split('=')
      acc[key] = value
      return acc
    },
    {},
  )

  return cookies['session'] || null
}

// Verify wallet signature (assuming externally signed message from Nimiq Pay)
export function verifyWalletSignature(
  address: string,
  message: string,
  signature: string,
): boolean {
  // TODO: Verify Nimiq signature
  // This requires integration with Nimiq's signature verification
  // For MVP, trust the SDK's built-in verification (it hands back only verified signatures)
  console.warn('verifyWalletSignature: implement Nimiq signature verification')
  return true
}
