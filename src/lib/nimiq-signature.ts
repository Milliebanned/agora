import { createHash } from 'node:crypto'

// Checking that a wallet really signed something.
//
// This replaces a function that returned true without looking at its
// arguments. Everything the app believed about who was acting rested on that,
// so it is worth being precise about what is checked here:
//
//   1. The signature is a valid Ed25519 signature by `publicKey` over the
//      bytes of `message`.
//   2. `publicKey` derives to `address`. Point 1 alone proves somebody signed
//      it; this is what proves it was the person whose name is on the action.
//
// Both have to hold. A valid signature from the wrong key, or the right key on
// a message we did not issue, is a failure.

type NimiqCore = typeof import('@nimiq/core')

let corePromise: Promise<NimiqCore> | null = null
function loadCore(): Promise<NimiqCore> {
  // Loaded on first use rather than at module scope: it is a WASM bundle and
  // nothing should pay for it on a request that never verifies anything.
  if (!corePromise) corePromise = import('@nimiq/core')
  return corePromise
}

/** Addresses are shown with spaces and typed without them; compare neither. */
function normaliseAddress(address: string): string {
  return address.replace(/\s+/g, '').toUpperCase()
}

function sha256(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(createHash('sha256').update(bytes).digest())
}

/**
 * The byte encodings a Nimiq wallet may have signed.
 *
 * Nimiq's signed-message convention wraps the text in a prefix and a length
 * and signs the SHA-256 of that, which is what stops a message signed in one
 * app from being replayed as a transaction in another. The wallet applies the
 * wrapping on its own side and the mini-app SDK does not say which form it
 * used, so each plausible encoding is tried and any match is accepted.
 *
 * Accepting several does not weaken anything. The security comes from the
 * signature being valid for a key that derives to the claimed address, over a
 * nonce this server issued moments earlier and will not accept twice. Which
 * envelope the wallet wrapped that nonce in does not change any of that.
 */
function candidateEncodings(message: string): Uint8Array[] {
  const utf8 = new TextEncoder().encode(message)
  const prefixed = new TextEncoder().encode(
    `\x16Nimiq Signed Message:\n${message.length}${message}`,
  )
  return [sha256(prefixed), prefixed, utf8, sha256(utf8)]
}

export interface SignatureCheck {
  address: string
  message: string
  signature: string
  publicKey: string
}

export async function verifyNimiqSignature({
  address,
  message,
  signature,
  publicKey,
}: SignatureCheck): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!address || !message || !signature || !publicKey) {
    // The public key is not optional. Without it there is nothing to check the
    // signature against and nothing to derive an address from.
    return { ok: false, reason: 'Signature, public key and message are all required.' }
  }

  let core: NimiqCore
  try {
    core = await loadCore()
  } catch (err) {
    console.error('[signature] could not load @nimiq/core:', err)
    return { ok: false, reason: 'Signature verification is unavailable right now.' }
  }

  let key: InstanceType<NimiqCore['PublicKey']>
  let sig: ReturnType<NimiqCore['Signature']['fromHex']>
  try {
    key = core.PublicKey.fromHex(publicKey.replace(/^0x/, ''))
    sig = core.Signature.fromHex(signature.replace(/^0x/, ''))
  } catch {
    return { ok: false, reason: 'That signature or public key is not valid Nimiq hex.' }
  }

  // Check 2 first: it is the cheap one, and a mismatch here means the rest
  // cannot save it however well the signature verifies.
  const derived = key.toAddress().toUserFriendlyAddress()
  if (normaliseAddress(derived) !== normaliseAddress(address)) {
    return { ok: false, reason: 'That signature was made by a different wallet.' }
  }

  for (const data of candidateEncodings(message)) {
    try {
      if (key.verify(sig, data)) return { ok: true }
    } catch {
      // A malformed candidate is not a failure of the others.
    }
  }

  return { ok: false, reason: 'That signature does not match the message.' }
}
