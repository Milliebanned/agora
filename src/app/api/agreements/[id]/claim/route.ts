import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken } from '@/lib/auth'
import prisma from '@/lib/db'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const session = request.cookies.get('session')?.value
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await verifySessionToken(session)
    if (!user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    const agreement = await prisma.agreement.findUnique({
      where: { id: id },
    })

    if (!agreement) {
      return NextResponse.json({ error: 'Agreement not found' }, { status: 404 })
    }

    // Only buyer or seller can trigger claim
    // Buyer triggers to approve seller's work, seller can initiate claim
    const isBuyer = agreement.buyerId === user.userId
    const isSeller = agreement.sellerId === user.userId

    if (!isBuyer && !isSeller) {
      return NextResponse.json({ error: 'Not a party to this agreement' }, { status: 403 })
    }

    // Escrow must be funded
    if (!agreement.htlcHashRoot || !agreement.htlcPreImage) {
      return NextResponse.json({ error: 'Escrow not funded' }, { status: 400 })
    }

    // Must have approved milestones (or all milestones completed for auto-release)
    const milestones = await prisma.milestone.findMany({
      where: { agreementId: id },
    })

    const allApproved = milestones.length > 0 && milestones.every((m) => m.status === 'approved')

    if (!allApproved && isBuyer) {
      return NextResponse.json(
        { error: 'Not all milestones are approved' },
        { status: 400 },
      )
    }

    // Build HTLC claim transaction with pre-image
    // This will be signed by the seller (recipient) to claim funds
    const claimTxData = {
      type: 'htlc_claim',
      htlcAddress: agreement.htlcAddress,
      preImage: agreement.htlcPreImage,
      recipient: agreement.sellerId,
      // The actual tx structure will be built by the SDK
    }

    // Mark as ready to claim
    const updated = await prisma.agreement.update({
      where: { id: id },
      data: {
        status: 'completed', // Mark as completed when claiming
      },
    })

    // Create claim transaction record
    await prisma.escrowTransaction.create({
      data: {
        agreementId: id,
        type: 'claim',
        status: 'pending',
      },
    })

    // Add system message
    await prisma.message.create({
      data: {
        agreementId: id,
        senderId: user.userId,
        type: 'system',
        content: `Funds release initiated. ${agreement.amountNIM} NIM will transfer to seller.`,
      },
    })

    // Update reputation (mark as completed)
    const rep = await prisma.reputationScore.findUnique({
      where: { userId: agreement.buyerId },
    })

    if (rep) {
      const completionRate = ((rep.completedAgreements + 1) / (rep.totalAgreements + 1)) * 100
      const trustScore = Math.min(100, Math.floor(completionRate * 0.8 + 20))

      await prisma.reputationScore.update({
        where: { userId: agreement.buyerId },
        data: {
          completedAgreements: rep.completedAgreements + 1,
          trustScore,
        },
      })
    } else {
      await prisma.reputationScore.create({
        data: {
          userId: agreement.buyerId,
          totalAgreements: 1,
          completedAgreements: 1,
          trustScore: 80,
        },
      })
    }

    return NextResponse.json({
      message: 'Ready to claim funds. Sign claim transaction in Nimiq Pay.',
      claimTxData,
      agreement: updated,
    })
  } catch (error) {
    console.error('Claim escrow error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
