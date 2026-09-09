import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import prisma from '@/lib/db'

// Proposals are the only channel before a freelancer is selected. There is no
// pre-selection chat on purpose: it keeps the record of who offered what clean
// enough to hand to the mediator, and it stops a board of open postings from
// turning into an inbox.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const user = await requireSession(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const opportunity = await prisma.agreement.findUnique({
      where: { id },
      select: { buyerId: true },
    })
    if (!opportunity) {
      return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 })
    }

    const isClient = opportunity.buyerId === user.userId

    const proposals = await prisma.proposal.findMany({
      where: {
        agreementId: id,
        // A freelancer sees their own pitch and nobody else's — rival bids are
        // not theirs to read.
        ...(isClient ? {} : { freelancerId: user.userId }),
      },
      include: {
        freelancer: {
          select: {
            id: true,
            address: true,
            displayName: true,
            bio: true,
            reputationScores: { select: { trustScore: true, completedAgreements: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(proposals)
  } catch (error) {
    console.error('List proposals error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const user = await requireSession(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const opportunity = await prisma.agreement.findUnique({ where: { id } })
    if (!opportunity) {
      return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 })
    }
    if (opportunity.buyerId === user.userId) {
      return NextResponse.json(
        { error: 'You cannot pitch for your own opportunity' },
        { status: 400 },
      )
    }
    if (opportunity.status !== 'open') {
      return NextResponse.json(
        { error: 'This opportunity is no longer taking proposals' },
        { status: 400 },
      )
    }

    const body = await request.json()
    const coverLetter = String(body.coverLetter ?? '').trim()
    const bidNIM = Number(body.bidNIM)
    const deliveryDays = Number(body.deliveryDays)
    const budget = Number(opportunity.budgetNIM ?? opportunity.amountNIM)

    const problems: string[] = []
    if (coverLetter.length < 30) problems.push('Tell the client how you would approach this (30+ characters)')
    if (!Number.isFinite(bidNIM) || bidNIM <= 0) problems.push('Bid must be above 0 NIM')
    // The escrow is already committed at the posted budget, so a bid above it
    // is money that does not exist.
    if (bidNIM > budget) problems.push(`Bid cannot exceed the ${budget} NIM budget`)
    if (!Number.isInteger(deliveryDays) || deliveryDays < 1)
      problems.push('Delivery time must be at least 1 day')

    if (problems.length > 0) {
      return NextResponse.json({ error: problems[0], problems }, { status: 400 })
    }

    // Re-pitching edits the existing proposal rather than stacking duplicates
    // in the client's list.
    const proposal = await prisma.proposal.upsert({
      where: { agreementId_freelancerId: { agreementId: id, freelancerId: user.userId } },
      create: {
        agreementId: id,
        freelancerId: user.userId,
        coverLetter: coverLetter.slice(0, 4000),
        bidNIM,
        deliveryDays,
        status: 'pending',
      },
      update: {
        coverLetter: coverLetter.slice(0, 4000),
        bidNIM,
        deliveryDays,
        status: 'pending',
      },
      include: {
        freelancer: { select: { id: true, address: true, displayName: true } },
      },
    })

    return NextResponse.json(proposal, { status: 201 })
  } catch (error) {
    console.error('Create proposal error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
