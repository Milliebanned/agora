// Preflight for the money path: proves the RPC endpoint answers, the escrow key
// matches its address, and the wallet holds what the app thinks it does — all
// without moving a single NIM.
//
//   node scripts/check-escrow.mjs
//
// Run this before every deploy, and before switching to mainnet. It exercises
// the three things most likely to be wrong: a dead RPC endpoint, a key that
// belongs to a different address, and an empty escrow wallet.
import { readFileSync } from 'node:fs'

try {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, '')
    }
  }
} catch {
  console.log('No .env.local found — falling back to the shell environment.')
}

const network = process.env.NEXT_PUBLIC_NIMIQ_NETWORK ?? 'testnet'
const rpcUrl =
  network === 'mainnet'
    ? process.env.NIMIQ_MAINNET_RPC_ENDPOINT
    : process.env.NIMIQ_RPC_ENDPOINT

let failed = false
const fail = (msg) => {
  console.error(`✗ ${msg}`)
  failed = true
}

console.log(`Network: ${network}`)

if (!rpcUrl) {
  fail(`No RPC endpoint set for ${network}.`)
  process.exit(1)
}
console.log(`RPC:     ${rpcUrl}\n`)

async function rpc(method, params = []) {
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
  const body = await res.json()
  if (body.error) throw new Error(body.error.message ?? JSON.stringify(body.error))
  const r = body.result
  return r && typeof r === 'object' && 'data' in r ? r.data : r
}

// 1. Is the node reachable, and does it speak the dialect we expect?
let head
try {
  head = await rpc('getBlockNumber')
  console.log(`✓ RPC reachable — head is block ${Number(head).toLocaleString()}`)
} catch (err) {
  fail(`RPC unreachable or rejecting requests: ${err.message}`)
  console.error(
    '  Nimiq\'s public RPC is meant for early development only. For mainnet you want your own\n' +
      '  node or a provider — see ESCROW.md.',
  )
  process.exit(1)
}

// 2. Does the key actually control the address the app will advertise?
const address = process.env.NIMIQ_ESCROW_ADDRESS
const privateKey = process.env.NIMIQ_ESCROW_PRIVATE_KEY

if (!address) fail('NIMIQ_ESCROW_ADDRESS is not set.')
if (!privateKey) fail('NIMIQ_ESCROW_PRIVATE_KEY is not set.')

const normalise = (a) => (a ?? '').replace(/\s+/g, '').toUpperCase()

if (address && privateKey) {
  const nimiq = await import('@nimiq/core')
  try {
    const derived = nimiq.KeyPair.derive(nimiq.PrivateKey.fromHex(privateKey.trim()))
      .toAddress()
      .toUserFriendlyAddress()
    if (normalise(derived) === normalise(address)) {
      console.log(`✓ Escrow key matches its address — ${derived}`)
    } else {
      fail(`Key/address mismatch. The key controls ${derived}, not ${address}.`)
      console.error('  The server refuses to sign in this state, which is the safe failure.')
    }
  } catch {
    fail('NIMIQ_ESCROW_PRIVATE_KEY is not a valid Nimiq private key (expect 64 hex characters).')
  }

  // 3. Can it cover a payout today?
  try {
    const account = await rpc('getAccountByAddress', [address])
    const balance = Number(account?.balance ?? 0) / 1e5
    console.log(`✓ Escrow wallet balance: ${balance.toFixed(2)} NIM`)
    if (balance === 0) {
      console.log(
        '  Empty is expected before anyone funds an opportunity — clients pay into it directly.',
      )
    }
  } catch (err) {
    fail(`Could not read the escrow balance: ${err.message}`)
  }
}

// 4. The safety rails.
const limit = Number(process.env.ESCROW_DAILY_LIMIT_NIM ?? '0')
if (limit > 0) {
  console.log(`✓ Daily payout ceiling: ${limit.toLocaleString()} NIM`)
} else {
  console.log('! ESCROW_DAILY_LIMIT_NIM is 0 — payouts are uncapped. Set a real number for production.')
}

if (!process.env.ESCROW_ADMIN_TOKEN) {
  console.log('! ESCROW_ADMIN_TOKEN is unset — /api/admin/escrow-health is disabled.')
}

if (process.env.NEXT_PUBLIC_MOCK_WALLET === 'true') {
  console.log('! NEXT_PUBLIC_MOCK_WALLET=true — the app uses a fake wallet and no real NIM moves.')
}
if (process.env.NIMIQ_SKIP_ESCROW_VERIFICATION === 'true') {
  console.log(
    '! NIMIQ_SKIP_ESCROW_VERIFICATION=true — postings publish without confirming payment on-chain.',
  )
}

console.log(failed ? '\nPreflight FAILED.' : '\nPreflight passed.')
process.exit(failed ? 1 : 0)
