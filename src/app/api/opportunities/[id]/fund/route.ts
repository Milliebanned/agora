import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { requireSession } from '@/lib/auth'
import prisma from '@/lib/db'
import { notify, TABS } from '@/lib/notifications'
import { randomHex, sha256, nimToSats } from '@/lib/utils'
import { getTransactionsByAddress, sameAddress, waitForTransaction } from '@/lib/nimiq-rpc'
import { checkSignedPayment } from '@/lib/escrow-verify'
import { resolveNetwork } from '@/lib/nimiq-network'

// @nimiq/core is WebAssembly — Node runtime, not edge.
export const runtime = 'nodejs'
// Confirming a fresh payment means waiting for it to leave the mempool.
export const maxDuration = 60

// Fund the opportunity. This is where real NIM leaves the client's wallet, and
// the one route where getting it wrong costs the user money rather than time.
//
// The ordering below is the whole point of this file. A payment is recorded
// *before* it is confirmed, because the failure that matters is not "we could
// not verify it" — it is "we could not verify it, so we left no trace, so the
// client paid again". A payment the chain has not admitted to yet is a payment
// that still happened.
//
// Nimiq Pay hands back the serialized transaction rather than its hash. That
// blob is signed by the client's own key, so the server can read who paid whom
// how much and derive the hash from it without asking any node — see
// src/lib/escrow-verify.ts. Chain confirmation then follows at its own pace.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const user = await requireSession(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const escrowAddress = process.env.NIMIQ_ESCROW_ADDRESS
    if (!escrowAddress) {
      return NextResponse.json(
        { error: 'NIMIQ_ESCROW_ADDRESS is not configured — the server has nowhere to receive escrow payments.' },
        { status: 500 },
      )
    }

    const opportunity = await prisma.agreement.findUnique({
      where: { id },
      include: { buyer: { select: { address: true } } },
    })

    if (!opportunity) {
      return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 })
    }
    if (opportunity.buyerId !== user.userId) {
      return NextResponse.json({ error: 'Only the client can fund this escrow' }, { status: 403 })
    }

    const expectedLuna = nimToSats(Number(opportunity.amountNIM))
    const skipVerification = process.env.NIMIQ_SKIP_ESCROW_VERIFICATION === 'true'

    // Already live? Say so plainly. A client whose connection dropped mid-publish
    // must be able to retry the request without it reading as a new payment.
    if (opportunity.status !== 'draft' || opportunity.htlcHashRoot) {
      const existing = await prisma.escrowTransaction.findFirst({
        where: { agreementId: id, type: 'fund' },
      })
      return NextResponse.json({
        message: 'This opportunity is already funded and live. Nothing further was charged.',
        alreadyFunded: true,
        opportunity,
        escrow: { txHash: existing?.txHash ?? null, escrowAddress, verified: true },
      })
    }

    const body = await request
      .json()
      .catch(() => ({}) as { serialized?: string; txHash?: string; recover?: boolean })
    const { serialized, txHash: reportedHash, recover } = body as {
      serialized?: string
      txHash?: string
      recover?: boolean
    }

    // Find a payment into escrow from this client that no posting has used yet.
    // The last resort when we have no hash: the chain is the only record left.
    const findUnclaimedPayment = async () => {
      const consumed = new Set(
        (
          await prisma.escrowTransaction.findMany({
            where: { type: 'fund', txHash: { not: null } },
            select: { txHash: true },
          })
        ).map((t) => t.txHash as string),
      )

      // Every other registered wallet. A payment from one of those belongs to
      // that person's deals, not this one, and must never be adopted here —
      // that is the only way this scan could take money from someone else.
      // An address nobody has signed in with is, in practice, another account
      // of this client's own wallet, which is exactly the case being rescued.
      const otherUsers = new Set(
        (
          await prisma.user.findMany({
            where: { id: { not: opportunity.buyerId } },
            select: { address: true },
          })
        ).map((u) => u.address.replace(/\s+/g, '').toUpperCase()),
      )

      const recent = await getTransactionsByAddress(escrowAddress, 100)
      const candidates = recent.filter(
        (tx) =>
          sameAddress(tx.to, escrowAddress) &&
          BigInt(Math.round(tx.value)) >= expectedLuna &&
          !consumed.has(tx.hash) &&
          !otherUsers.has((tx.from ?? '').replace(/\s+/g, '').toUpperCase()) &&
          // A payment that predates the posting cannot have been made for it.
          (!tx.timestamp || tx.timestamp >= opportunity.createdAt.getTime() - 60_000),
      )

      // Prefer one from the address this client signed in with; otherwise take
      // the oldest candidate, so repeated payments are consumed in the order
      // they were made rather than stranding the first one.
      return (
        candidates.find((tx) => sameAddress(tx.from, opportunity.buyer.address)) ??
        candidates.sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0))[0]
      )
    }

    // ---- Step 1: what payment are we talking about? ----
    //
    // A pending row from an earlier attempt wins over anything in this request.
    // If the client already paid and we recorded it, this call resumes that
    // payment; it must never become the reason for a second one.
    let pending = await prisma.escrowTransaction.findFirst({
      where: { agreementId: id, type: 'fund' },
    })

    if (!pending) {
      let hash: string | null = null
      let fromAddress: string | null = null

      if (serialized) {
        // The wallet's own signed transaction. Validated against this deal
        // before it is recorded — otherwise a 1 NIM transfer could publish a
        // 500 NIM posting.
        const check = await checkSignedPayment(serialized, { escrowAddress, expectedLuna })
        if (check.ok) {
          hash = check.payment!.txHash
          fromAddress = check.payment!.from
        } else if (check.payment) {
          // It decoded, and it is genuinely the wrong payment — wrong address,
          // wrong payer, or too little. Refusing is right, and no money of this
          // client's is at stake in this posting.
          return NextResponse.json(
            { error: 'That payment does not match this posting', detail: check.reason },
            { status: 400 },
          )
        } else if (/^[0-9a-f]{64}$/i.test(serialized.trim())) {
          // Not decodable, but it is a transaction hash. Some wallet builds
          // return the hash where the SDK's types promise the serialized
          // transaction; take it at its word and let the chain check settle it.
          hash = serialized.trim()
        } else {
          // Unreadable. The client's NIM may well be gone, so this must not end
          // as a bare error that leaves no record — fall through with no hash
          // and let the chain scan below find the payment once it lands.
          console.warn(
            `[escrow] could not read the wallet's transaction for deal ${id}: ${check.reason}`,
          )
        }
      } else if (reportedHash) {
        hash = reportedHash
      } else if (recover) {
        // "I already paid" — the recovery path for a payment made before this
        // deal had any record of it. The chain is the only evidence left, so
        // scan it, and refuse any transaction another posting already used.
        const match = await findUnclaimedPayment()

        if (!match) {
          // "Not found" is the same sentence whether the chain is empty, the
          // server is on the wrong network, or the payment is simply too small.
          // Say which, because the difference is the whole diagnosis.
          const seen = await getTransactionsByAddress(escrowAddress, 100).catch(() => [])
          const incoming = seen.filter((tx) => sameAddress(tx.to, escrowAddress))
          return NextResponse.json(
            {
              error: 'No unclaimed payment was found in the escrow account',
              detail:
                incoming.length === 0
                  ? `The escrow account ${escrowAddress} shows no incoming payments at all on ${resolveNetwork()}. Either the payment has not confirmed yet, or this deployment is pointed at the wrong network or the wrong escrow address.`
                  : `${incoming.length} incoming payment(s) found on ${resolveNetwork()}, but none of at least ${Number(opportunity.amountNIM)} NIM that is unclaimed and dated after this posting was created.`,
              network: resolveNetwork(),
              escrowAddress,
              incomingSeen: incoming.length,
            },
            { status: 404 },
          )
        }
        hash = match.hash
        fromAddress = match.from ?? null
      } else if (!skipVerification) {
        return NextResponse.json(
          { error: 'No payment was supplied to verify.' },
          { status: 400 },
        )
      }

      // ---- Step 2: record it before confirming it. ----
      //
      // This is the line that stops a client paying twice. From here on the
      // payment exists in our records whatever the chain says, and the unique
      // constraint on (agreementId, type) means a concurrent second attempt
      // finds this row instead of creating another.
      try {
        pending = await prisma.escrowTransaction.create({
          data: {
            agreementId: id,
            type: 'fund',
            status: 'pending',
            txHash: hash,
            fromAddress,
            amountNIM: Number(opportunity.amountNIM),
          },
        })
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          pending = await prisma.escrowTransaction.findFirst({
            where: { agreementId: id, type: 'fund' },
          })
        } else {
          throw err
        }
      }
    }

    // ---- Step 3: confirm against the chain. ----
    let confirmedTxHash = pending?.txHash ?? null

    if (skipVerification) {
      console.warn(
        'NIMIQ_SKIP_ESCROW_VERIFICATION=true — publishing without checking the chain. Never set this in production.',
      )
    } else {
      // A recorded payment we could not name. It exists — the client's wallet
      // says so — but we never got a hash for it, so the chain is the only way
      // to identify it. Look for it, and adopt it if it has landed.
      if (!confirmedTxHash) {
        const found = await findUnclaimedPayment()
        if (!found) {
          return NextResponse.json(
            {
              message:
                'Your payment is recorded but has not appeared on the network yet. Do not pay again — reopen this page in a minute and it will publish itself.',
              pending: true,
              paymentRecorded: true,
            },
            { status: 202 },
          )
        }
        confirmedTxHash = found.hash
        await prisma.escrowTransaction.update({
          where: { id: pending!.id },
          data: { txHash: found.hash, fromAddress: found.from ?? null },
        })
      }

      let onChain
      try {
        onChain = await waitForTransaction(confirmedTxHash)
      } catch (err) {
        // The payment stands; only our view of it failed. Say so in a way that
        // cannot be mistaken for "send it again".
        return NextResponse.json(
          {
            error: 'Could not reach the Nimiq network to confirm your payment',
            detail: err instanceof Error ? err.message : String(err),
            paymentRecorded: true,
            txHash: confirmedTxHash,
          },
          { status: 503 },
        )
      }

      if (!onChain) {
        // Recorded, broadcast, not yet in a block. The correct answer is "wait",
        // never "pay again" — 202 rather than an error, because nothing failed.
        return NextResponse.json(
          {
            message:
              'Your payment is recorded and waiting to confirm on the network. Do not pay again — reopen this page in a minute and it will publish itself.',
            pending: true,
            paymentRecorded: true,
            txHash: confirmedTxHash,
          },
          { status: 202 },
        )
      }

      // The chain's own copy is the last word on where the money went.
      if (!sameAddress(onChain.to, escrowAddress)) {
        return NextResponse.json(
          { error: 'That transaction did not pay the escrow address.' },
          { status: 400 },
        )
      }
      if (BigInt(Math.round(onChain.value)) < expectedLuna) {
        return NextResponse.json(
          { error: 'That transaction paid less than the posted budget.' },
          { status: 400 },
        )
      }
      confirmedTxHash = onChain.hash
    }

    // ---- Step 4: publish. ----
    const preImage = randomHex(32)
    const hashRoot = await sha256(preImage)

    const [published] = await prisma.$transaction([
      prisma.agreement.update({
        where: { id },
        data: {
          htlcHashRoot: hashRoot,
          htlcPreImage: preImage,
          status: 'open',
          publishedAt: new Date(),
        },
        include: { buyer: { select: { id: true, address: true, displayName: true } } },
      }),
      prisma.escrowTransaction.update({
        where: { id: pending!.id },
        data: {
          status: skipVerification ? 'pending' : 'confirmed',
          txHash: confirmedTxHash,
          ...(skipVerification ? {} : { confirmedAt: new Date() }),
        },
      }),
    ])

    // A directed posting has an audience of one, and no board to be found on.
    if (published.invitedSellerId) {
      await notify({
        userId: published.invitedSellerId,
        tab: TABS.deals,
        type: 'invited_job',
        body: `${published.buyer?.displayName ?? 'A client'} sent you a job from your advertisement: "${published.title}".`,
        href: `/dashboard/opportunities/${id}`,
        agreementId: id,
      })
    }

    return NextResponse.json({
      message: skipVerification
        ? 'Published without on-chain verification (development mode).'
        : `${Number(opportunity.amountNIM).toFixed(2)} NIM confirmed in escrow. The opportunity is now live.`,
      opportunity: published,
      escrow: { txHash: confirmedTxHash, escrowAddress, verified: !skipVerification },
    })
  } catch (error) {
    console.error('Fund opportunity error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
