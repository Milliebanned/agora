#!/usr/bin/env node
//
// Generates the escrow wallet keypair.
//
//   node scripts/generate-escrow-key.js
//
// Run it on a machine you trust, offline if you can. The private key it prints
// controls every NIM the platform holds in escrow — back it up somewhere
// offline before you fund the address, because there is no recovery, and never
// paste it into a chat, an issue, or a commit.

const nimiq = require('@nimiq/core')

const privateKey = nimiq.PrivateKey.generate()
const keyPair = nimiq.KeyPair.derive(privateKey)
const address = keyPair.toAddress().toUserFriendlyAddress()

console.log(`
Escrow wallet generated.

  NIMIQ_ESCROW_ADDRESS=${address}
  NIMIQ_ESCROW_PRIVATE_KEY=${privateKey.toHex()}

Next:
  1. Back up the private key offline. Losing it freezes every escrowed NIM
     permanently; leaking it hands them to whoever finds it.
  2. Put both values in your environment. The server refuses to sign anything
     unless the key derives to the address, so they must travel together.
  3. Fund the address before anyone tries to claim a payout.

Read ESCROW.md before using this on mainnet.
`)
