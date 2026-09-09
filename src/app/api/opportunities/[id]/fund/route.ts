import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import prisma from '@/lib/db'
import { randomHex, sha256, nimToSats } from '@/lib/utils'
import { verifyEscrowFunding } from '@/lib/nimiq-rpc'

// Fund the opportunity. This is where real NIM leaves the client's wallet.
//
// The browser has already asked Nimiq Pay to send the budget to the NimTrust
// escrow address and hands us what the wallet returned. That claim is worth
// nothing on its own — anyone can POST to this route — so the server asks the
// chain whether the payment actually happened, and only then does the posting
// go live. An unverified claim publishes nothing.
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
    if (opportunity.htlcHashRoot) {
      return NextResponse.json({ error: 'This escrow is already funded' }, { status: 400 })
    }
    if (opportunity.status !== 'draft') {
      return NextResponse.json(
        { error: `A ${opportunity.status} opportunity cannot be funded` },
        { status: 400 },
      )
    }

    const { txHash } = await request.json().catch(() => ({ txHash: null }))
    const expectedLuna = nimToSats(Number(opportunity.amountNIM))

    // Local development against a mock wallet has no chain to check. It must be
    // opt-in on the server, never inferred from what the client tells us.
    const skipVerification = process.env.NIMIQ_SKIP_ESCROW_VERIFICATION === 'true'

    let confirmedTxHash: string | null = txHash ?? null

    if (skipVerification) {
      console.warn(
        'NIMIQ_SKIP_ESCROW_VERIFICATION=true — publishing without checking the chain. Never set this in production.',
      )
    } else {
      try {
        const check = await verifyEscrowFunding({
          escrowAddress,
          from: opportunity.buyer.address,
          expectedLuna,
          txHash,
        })
        if (!check.ok) {
          return NextResponse.json(
            {
              error: 'Escrow payment could not be confirmed on-chain',
              detail: check.reason,
            },
            { status: 402 },
          )
        }
        confirmedTxHash = check.transaction?.hash ?? confirmedTxHash
      } catch (err) {
        return NextResponse.json(
          {
            error: 'Could not reach the Nimiq network to confirm the payment',
            detail: err instanceof Error ? err.message : String(err),
          },
          { status: 503 },
        )
      }
    }

    // The release secret still governs who gets paid: it is revealed to the
    // freelancer only when the client approves the work.
    const preImage = randomHex(32)
    const hashRoot = await sha256(preImage)

    const published = await prisma.agreement.update({
      where: { id },
      data: {
        htlcHashRoot: hashRoot,
        htlcPreImage: preImage,
        status: 'open',
        publishedAt: new Date(),
      },
      include: { buyer: { select: { id: true, address: true, displayName: true } } },
    })

    await prisma.escrowTransaction.create({
      data: {
        agreementId: id,
        type: 'fund',
        status: skipVerification ? 'pending' : 'confirmed',
        txHash: confirmedTxHash,
        ...(skipVerification ? {} : { confirmedAt: new Date() }),
      },
    })

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
