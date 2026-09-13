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
 * Nimiq's signed-message convention wraps the text in a prefix and its length
 * and signs the SHA-256 of that, which is what stops a message signed in one
 * app from being replayed as a transaction in another.
 *
 * The length is the message's length **in UTF-8 bytes**, not in JavaScript
 * characters. Those are the same number for plain ASCII and different the
 * moment anything else appears: a curly apostrophe is three bytes and one
 * character, and a phone keyboard inserts one every time somebody types "Jane's
 * logo". Using the character count verified every ASCII message and failed
 * every other one, which is why signing in worked and accepting a verdict —
 * whose text contained a typographic apostrophe — did not.
 *
 * The character-count spelling is kept as a later candidate rather than
 * deleted: it costs one hash to try and covers a wallet that does it the other
 * way. Accepting several encodings does not weaken anything, because the
 * security comes from the signature being valid for a key that derives to the
 * claimed address, over a nonce this server issued moments earlier and will
 * not accept twice.
 */
function candidateEncodings(message: string): { label: string; data: Uint8Array }[] {
  const utf8 = new TextEncoder().encode(message)
  const prefix = new TextEncoder().encode('\x16Nimiq Signed Message:\n')

  const wrap = (length: number) => {
    const digits = new TextEncoder().encode(String(length))
    const out = new Uint8Array(prefix.length + digits.length + utf8.length)
    out.set(prefix, 0)
    out.set(digits, prefix.length)
    out.set(utf8, prefix.length + digits.length)
    return out
  }

  const byByteLength = wrap(utf8.length)
  const byCharLength = wrap(message.length)

  return [
    { label: 'sha256(prefix+byteLength+utf8)', data: sha256(byByteLength) },
    { label: 'sha256(prefix+charLength+utf8)', data: sha256(byCharLength) },
    { label: 'prefix+byteLength+utf8', data: byByteLength },
    { label: 'utf8', data: utf8 },
    { label: 'sha256(utf8)', data: sha256(utf8) },
  ]
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

  for (const candidate of candidateEncodings(message)) {
    try {
      if (key.verify(sig, candidate.data)) {
        // Logged so the encoding a real wallet actually uses is on the record
        // rather than inferred, the next time one of these goes wrong.
        console.info(`[signature] verified via ${candidate.label}`)
        return { ok: true }
      }
    } catch {
      // A malformed candidate is not a failure of the others.
    }
  }

  return { ok: false, reason: 'That signature does not match the message.' }
}
