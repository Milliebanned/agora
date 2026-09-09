# Escrow operations

NimTrust holds other people's money. This is what that means operationally.

## How the money actually moves

```
Client's wallet ──[1] on-chain transfer──► Escrow wallet ──[3] on-chain transfer──► Freelancer
                                          (server holds key)
                                                   ▲
                                                [2] approval — database only, nothing on chain
```

1. **Funding.** The client publishes an opportunity. Nimiq Pay sends the budget
   to `NIMIQ_ESCROW_ADDRESS`. The server verifies the payment against the chain
   before the posting goes live — an unverified claim publishes nothing.
2. **Approval.** The client approves the work. This is a database state change.
   No NIM moves.
3. **Payout.** The freelancer taps Claim. The server signs a transfer from the
   escrow wallet to the address they authenticated with, and broadcasts it.

The rules — only after approval, only to the assigned freelancer, only once —
live in `src/app/api/opportunities/[id]/claim/route.ts`, not on the blockchain.
This is custodial escrow. The transfers are real; the enforcement is our code.

Why not an HTLC, given Nimiq supports them natively: `@nimiq/mini-app-sdk`
v0.1.0 exposes no contract-creation method, and `@nimiq/core`'s
`Transaction.sign()` throws on HTLC redemption. Neither side of a redemption can
be signed from this stack, so an HTLC here would lock funds that only a timeout
could release. Revisit if the SDK gains transaction signing.

## The key

`NIMIQ_ESCROW_PRIVATE_KEY` controls every NIM in escrow. If it leaks, all of it
goes. If it is lost, all of it freezes permanently.

Generate one offline, never on a shared machine:

```js
const { PrivateKey, KeyPair } = require('@nimiq/core')
const key = PrivateKey.generate()
console.log('address:', KeyPair.derive(key).toAddress().toUserFriendlyAddress())
console.log('private key:', key.toHex())
```

Back up the private key somewhere offline before funding the address. There is
no recovery.

The server refuses to sign anything unless the key derives to
`NIMIQ_ESCROW_ADDRESS`, so a mismatched pair fails loudly at the first payout
rather than quietly paying out of some other account.

### Where it lives, by stage

| Stage | Storage | Honest assessment |
|---|---|---|
| Testnet / demo | Vercel env var | Fine. The coins are worthless. |
| First real users | Signing service off Vercel | On Vercel the key shares a process with every npm dependency in the app. Move signing to a small dedicated service exposing one endpoint — *pay deal X its recorded amount* — never "sign this transaction". |
| Real volume | 2-of-3 multisig | Nimiq supports it (`PartialSignature`, `Commitment` in `@nimiq/core`). One leaked key stops being fatal. Note it is MuSig-style: signing needs an interactive commitment round with both signers online. |

Cloud KMS is worth checking but may not help: KMS signing generally covers
ECDSA and RSA, not the Ed25519 that Nimiq uses, so "the key never leaves the
HSM" may be unavailable. Envelope encryption — KMS decrypts the key at runtime —
works regardless.

Independent of storage: keep only imminent payouts in the escrow wallet and
sweep the rest to an offline address. That caps the blast radius of everything
above.

## Controls in the code

- **Destination** is read from the database — the address the freelancer
  authenticated with. Nothing in a request body influences where money goes.
- **Idempotency** is a unique constraint on `EscrowTransaction(agreementId,
  type)`, and the row is written *before* signing. Two concurrent claims: one
  wins the insert, the other never reaches the signer.
- **Retry safety.** Before signing, the chain is checked for an existing payout
  from escrow to that address since approval. A failure that might have
  broadcast leaves the row claimed and needs a human — reopening it is how
  someone gets paid twice. Only pre-signing configuration errors release it.
- **Daily ceiling.** `ESCROW_DAILY_LIMIT_NIM` caps rolling 24-hour outflow.
  Past it, payouts refuse with a 429 and log at error level.

## Monitoring

`GET /api/admin/escrow-health` with `Authorization: Bearer $ESCROW_ADMIN_TOKEN`
reconciles the wallet balance against what the database says is owed.

```json
{ "healthy": true, "balanceNIM": 4200, "owedNIM": 4200, "driftNIM": 0, "stuckPayouts": 0 }
```

Poll it from an uptime monitor and alert on `healthy: false`. Negative drift
means the wallet cannot cover its obligations — wake someone up. `stuckPayouts`
counts claims left pending or failed; each one is a person who has not been paid
and needs a manual resolution.

## If the key is compromised

1. Sweep the escrow wallet to a new address immediately. Speed beats process.
2. Set `ESCROW_DAILY_LIMIT_NIM=0.00001` to halt payouts.
3. Generate a new keypair; update `NIMIQ_ESCROW_ADDRESS` and
   `NIMIQ_ESCROW_PRIVATE_KEY` together — the server will refuse to sign if they
   disagree, which is the safe failure.
4. Reconcile: every `open`, `locked`, `submitted` and `disputed` deal with a
   funded escrow is a real obligation, whatever the wallet balance now says.

## Before mainnet

Holding pooled user funds and paying them out is money transmission in most
jurisdictions. No amount of key management addresses that. Worth a conversation
with someone who knows your jurisdiction, separate from the engineering.
