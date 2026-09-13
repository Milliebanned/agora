import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'node:crypto'

export const runtime = 'nodejs'

// The development wallet's signing key.
//
// This exists so that local testing exercises the same code path a real wallet
// does: the server verifies a genuine Ed25519 signature and has no idea it came
// from a mock. The alternative was a special case in the verifier that waved
// development signatures through, which is a hole that would then exist in
// production forever.
//
// It refuses to exist outside development. Vercel builds with NODE_ENV set to
// production, so this route is a 404 there, and the key it derives is seeded
// from a public string in a public repository: it guards nothing.
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    const { seed, message } = await request.json()
    if (typeof seed !== 'string' || typeof message !== 'string') {
      return NextResponse.json({ error: 'seed and message are required' }, { status: 400 })
    }

    const core = await import('@nimiq/core')
    const privateKeyHex = createHash('sha256').update(`agora-mock-wallet:${seed}`).digest('hex')
    const keyPair = core.KeyPair.derive(core.PrivateKey.fromHex(privateKeyHex))

    // Nimiq's signed-message convention: a prefix, the length, the text, and
    // the signature is over the SHA-256 of all of it.
    const wrapped = Buffer.from(`\x16Nimiq Signed Message:\n${message.length}${message}`, 'utf8')
    const digest = new Uint8Array(createHash('sha256').update(wrapped).digest())

    return NextResponse.json({
      address: keyPair.toAddress().toUserFriendlyAddress(),
      publicKey: keyPair.publicKey.toHex(),
      signature: keyPair.sign(digest).toHex(),
    })
  } catch (error) {
    console.error('Mock wallet error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
