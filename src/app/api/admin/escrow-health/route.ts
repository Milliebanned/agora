import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { assertEscrowWalletReady } from '@/lib/escrow-wallet'
import { getAccountByAddress } from '@/lib/nimiq-rpc'
import { resolveNetwork } from '@/lib/nimiq-network'

export const runtime = 'nodejs'

// Reconciliation. What the escrow wallet actually holds, against what the
// database says it owes.
//
// Drift is the earliest signal that something is wrong — a payout that went out
// without a row, funds moving that the app did not initiate, a client payment
// credited that never arrived. Worth polling from an uptime monitor and
// alerting on `healthy: false`.
//
// Not a user-facing route: it names balances and the escrow address, so it sits
// behind a shared secret rather than a session.
export async function GET(request: NextRequest) {
  const token = process.env.ESCROW_ADMIN_TOKEN
  if (!token) {
    return NextResponse.json(
      { error: 'ESCROW_ADMIN_TOKEN is not configured; the health check is disabled.' },
      { status: 503 },
    )
  }
  if (request.headers.get('authorization') !== `Bearer ${token}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let network: string
  try {
    network = resolveNetwork()
  } catch (err) {
    return NextResponse.json(
      { healthy: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }

  try {
    const { address } = await assertEscrowWalletReady()

    // Everything funded and not yet paid out or refunded is money the platform
    // is holding on someone's behalf.
    const outstanding = await prisma.agreement.aggregate({
      where: {
        status: { in: ['open', 'locked', 'submitted', 'disputed'] },
        htlcHashRoot: { not: null },
      },
      _sum: { amountNIM: true },
      _count: true,
    })

    const owed = Number(outstanding._sum.amountNIM ?? 0)

    let balance: number | null = null
    let chainError: string | null = null
    try {
      const account = await getAccountByAddress(address)
      balance = Number(account.balance) / 1e5
    } catch (err) {
      chainError = err instanceof Error ? err.message : String(err)
    }

    const drift = balance === null ? null : Number((balance - owed).toFixed(5))
    // A surplus is untidy; a shortfall means the wallet cannot cover what it
    // owes, which is the one that needs waking somebody up.
    const healthy = drift !== null && drift >= 0

    // Refunds are counted alongside claims: a mediated settlement pays the
    // client as well as the freelancer, and a stuck refund is just as much
    // somebody waiting on money that never arrived.
    const stuck = await prisma.escrowTransaction.count({
      where: { type: { in: ['claim', 'refund'] }, status: { in: ['pending', 'failed'] } },
    })

    return NextResponse.json({
      healthy,
      // Which chain this deployment actually talks to. First thing to check
      // when payments "never arrive": a server pointed at the wrong network
      // finds nothing, forever, and says so in the same words as an empty one.
      network,
      escrowAddress: address,
      balanceNIM: balance,
      owedNIM: owed,
      openDeals: outstanding._count,
      driftNIM: drift,
      stuckPayouts: stuck,
      chainError,
      checkedAt: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json(
      { healthy: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
