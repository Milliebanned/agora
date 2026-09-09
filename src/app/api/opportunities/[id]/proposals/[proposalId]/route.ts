import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import prisma from '@/lib/db'
import { recordEngagement } from '@/lib/reputation'

// Accepting a proposal is the hinge of the whole marketplace: it names who the
// escrowed budget is earmarked for, opens the private chat, and closes the
// posting to further pitches. The money is already off the client's wallet and
// in the escrow account by this point — funding happens at publication, not
// here — so nothing on-chain needs to move for a deal to be struck.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; proposalId: string }> },
) {
  try {
    const { id, proposalId } = await params
    const user = await requireSession(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { action, currentBlock } = await request.json()

    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      include: {
        freelancer: { select: { id: true, address: true, displayName: true } },
        agreement: { include: { buyer: { select: { address: true, displayName: true } } } },
      },
    })

    if (!proposal || proposal.agreementId !== id) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
    }

    const opportunity = proposal.agreement
    const isClient = opportunity.buyerId === user.userId
    const isAuthor = proposal.freelancerId === user.userId

    if (action === 'withdraw') {
      if (!isAuthor) {
        return NextResponse.json({ error: 'Not your proposal' }, { status: 403 })
      }
      if (proposal.status === 'accepted') {
        return NextResponse.json(
          { error: 'An accepted proposal cannot be withdrawn — open a dispute instead' },
          { status: 400 },
        )
      }
      return NextResponse.json(
        await prisma.proposal.update({ where: { id: proposalId }, data: { status: 'withdrawn' } }),
      )
    }

    if (!isClient) {
      return NextResponse.json({ error: 'Only the client can decide on proposals' }, { status: 403 })
    }

    if (action === 'reject') {
      return NextResponse.json(
        await prisma.proposal.update({ where: { id: proposalId }, data: { status: 'rejected' } }),
      )
    }

    if (action !== 'accept') {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }

    if (opportunity.status !== 'open') {
      return NextResponse.json(
        { error: 'This opportunity already has a freelancer' },
        { status: 400 },
      )
    }
    if (proposal.status !== 'pending') {
      return NextResponse.json({ error: `This proposal was already ${proposal.status}` }, { status: 400 })
    }
    if (!opportunity.htlcHashRoot) {
      return NextResponse.json(
        { error: 'Commit the budget before accepting a proposal' },
        { status: 400 },
      )
    }

    const bid = Number(proposal.bidNIM)
    const timeoutBlocks = parseInt(process.env.HTLC_TIMEOUT_BLOCKS || '14400', 10)
    // Recorded as the block after which an unresolved deal is treated as
    // abandoned and the escrow is refundable to the client.
    const head = Number.isFinite(Number(currentBlock)) ? Number(currentBlock) : 0
    const htlcTimeout = head + timeoutBlocks

    // Everything that defines the engagement moves together — a half-accepted
    // proposal would leave an opportunity that is neither open nor worked on.
    const [locked] = await prisma.$transaction([
      prisma.agreement.update({
        where: { id },
        data: {
          sellerId: proposal.freelancerId,
          // The escrow narrows from the posted budget to what was actually
          // agreed; the difference never leaves the client's wallet.
          amountNIM: bid,
          status: 'locked',
          lockedAt: new Date(),
          deadline: new Date(Date.now() + proposal.deliveryDays * 86400000),
          htlcTimeout,
        },
        include: {
          buyer: { select: { id: true, address: true, displayName: true } },
          seller: { select: { id: true, address: true, displayName: true } },
        },
      }),
      prisma.proposal.update({ where: { id: proposalId }, data: { status: 'accepted' } }),
      prisma.proposal.updateMany({
        where: { agreementId: id, status: 'pending', NOT: { id: proposalId } },
        data: { status: 'rejected' },
      }),
      prisma.message.create({
        data: {
          agreementId: id,
          senderId: user.userId,
          type: 'system',
          content: `${proposal.freelancer.displayName ?? 'The freelancer'} was accepted at ${bid} NIM, ${proposal.deliveryDays} days. Escrow is locking; this chat is now open and is retained as dispute evidence.`,
        },
      }),
    ])

    await recordEngagement([opportunity.buyerId, proposal.freelancerId])

    return NextResponse.json({ opportunity: locked })
  } catch (error) {
    console.error('Decide proposal error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
