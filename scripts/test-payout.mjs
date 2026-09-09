// Sends one real payout from the escrow wallet, outside the app.
//
//   node scripts/test-payout.mjs <recipient-address> <amount-nim> --yes
//
// Why this exists: if the first thing you ever run is the full app flow and it
// fails, you cannot tell whether the bug is in the signing, the RPC, or the API
// route. This exercises only signing and broadcast, so a failure here points at
// exactly one layer. Run it once before trusting the app with a real budget.
//
// It mirrors payFromEscrow() in src/lib/escrow-wallet.ts. If you change the
// signing there, change it here too — or delete this script once you trust the
// path.
//
// THIS MOVES REAL MONEY. It refuses to run without --yes, and caps the amount.
import { readFileSync } from 'node:fs'

const MAX_TEST_NIM = 10

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

const [recipient, amountArg] = process.argv.slice(2)
const confirmed = process.argv.includes('--yes')
const amountNIM = Number(amountArg)

if (!recipient || !Number.isFinite(amountNIM)) {
  console.error('Usage: node scripts/test-payout.mjs <recipient-address> <amount-nim> --yes')
  process.exit(1)
}
if (amountNIM <= 0 || amountNIM > MAX_TEST_NIM) {
  console.error(`Refusing: amount must be between 0 and ${MAX_TEST_NIM} NIM. This is a smoke test.`)
  process.exit(1)
}

const network = process.env.NEXT_PUBLIC_NIMIQ_NETWORK ?? 'testnet'
const rpcUrl =
  network === 'mainnet'
    ? process.env.NIMIQ_MAINNET_RPC_ENDPOINT
    : process.env.NIMIQ_RPC_ENDPOINT
const networkId = Number(process.env.NIMIQ_NETWORK_ID ?? (network === 'mainnet' ? 24 : 5))
const feeLuna = Number(process.env.ESCROW_PAYOUT_FEE_LUNA ?? '0')

const address = process.env.NIMIQ_ESCROW_ADDRESS
const privateKey = process.env.NIMIQ_ESCROW_PRIVATE_KEY
if (!rpcUrl || !address || !privateKey) {
  console.error('Missing NIMIQ_ESCROW_ADDRESS, NIMIQ_ESCROW_PRIVATE_KEY, or the RPC endpoint.')
  process.exit(1)
}

console.log(`
  Network   : ${network} (id ${networkId})
  From      : ${address}
  To        : ${recipient}
  Amount    : ${amountNIM} NIM
  Fee       : ${feeLuna} luna
`)

if (!confirmed) {
  console.log('Dry run. Re-run with --yes to actually send this.')
  process.exit(0)
}

async function rpc(method, params = []) {
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
  const body = await res.json()
  if (body.error) throw new Error(body.error.message ?? JSON.stringify(body.error))
  const r = body.result
  return r && typeof r === 'object' && 'data' in r ? r.data : r
}

const nimiq = await import('@nimiq/core')

const keyPair = nimiq.KeyPair.derive(nimiq.PrivateKey.fromHex(privateKey.trim()))
const derived = keyPair.toAddress().toUserFriendlyAddress()
const normalise = (a) => a.replace(/\s+/g, '').toUpperCase()
if (normalise(derived) !== normalise(address)) {
  console.error(`✗ Key controls ${derived}, not ${address}. Refusing to send.`)
  process.exit(1)
}
console.log('✓ Key matches its address')

const head = await rpc('getBlockNumber')
console.log(`✓ Chain head: block ${Number(head).toLocaleString()}`)

const transaction = nimiq.TransactionBuilder.newBasic(
  keyPair.toAddress(),
  nimiq.Address.fromUserFriendlyAddress(recipient),
  BigInt(Math.round(amountNIM * 1e5)),
  BigInt(feeLuna),
  head,
  networkId,
)
transaction.sign(keyPair, undefined)
console.log(`✓ Signed. Local hash: ${transaction.hash()}`)

try {
  const hash = await rpc('sendRawTransaction', [transaction.toHex()])
  console.log(`\n✓ Broadcast accepted. Transaction: ${hash || transaction.hash()}`)
  console.log('  Check it on a block explorer before running the app flow.')
} catch (err) {
  console.error(`\n✗ Broadcast rejected: ${err.message}`)
  console.error('  Nothing was sent. Common causes: wrong network id, insufficient balance,')
  console.error('  a fee the node will not accept, or an RPC that does not allow sendRawTransaction.')
  process.exit(1)
}
