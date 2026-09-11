import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import prisma from '@/lib/db'
import {
  BUDGET_BANDS,
  TIMELINE_BANDS,
  isValidCategory,
  sanitizeAttachments,
  sanitizeDeliverables,
  sortOrderBy,
} from '@/lib/opportunities'

// The public board. Only funded postings are listed: an opportunity without a
// committed budget is just a wish, and the whole point of the marketplace is
// that a freelancer can trust the money is there before writing a proposal.
export async function GET(request: NextRequest) {
  try {
    const user = await requireSession(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const q = request.nextUrl.searchParams
    const scope = q.get('scope') ?? 'board'

    const band = BUDGET_BANDS.find((b) => b.id === q.get('budget'))
    const timeline = TIMELINE_BANDS.find((t) => t.id === q.get('timeline'))
    const category = q.get('category')

    const where: Record<string, unknown> = {}

    if (scope === 'mine') {
      // Everything this user posted, drafts included — this is their own list.
      where.buyerId = user.userId
    } else if (scope === 'assigned') {
      where.sellerId = user.userId
    } else if (scope === 'applied') {
      // Everything this user has pitched for. `assigned` only covers work
      // already won, so without this a freelancer has nowhere to see a proposal
      // that is still pending — or one that was turned down.
      where.proposals = { some: { freelancerId: user.userId } }
    } else {
      where.status = 'open'
      where.publishedAt = { not: null }
    }

    if (isValidCategory(category)) where.category = category

    if (band && (band.min !== null || band.max !== null)) {
      where.amountNIM = {
        ...(band.min !== null ? { gte: band.min } : {}),
        ...(band.max !== null ? { lte: band.max } : {}),
      }
    }

    if (timeline?.maxDays) {
      where.timelineDays = { lte: timeline.maxDays, not: null }
    }

    const opportunities = await prisma.agreement.findMany({
      where,
      include: {
        buyer: { select: { id: true, address: true, displayName: true } },
        seller: { select: { id: true, address: true, displayName: true } },
        _count: { select: { proposals: true } },
        // Only the caller's own pitch, and only where they asked for it, so
        // every other scope returns exactly the payload it always has. A rival
        // bid stays private in all cases.
        ...(scope === 'applied'
          ? {
              proposals: {
                where: { freelancerId: user.userId },
                select: {
                  id: true,
                  status: true,
                  bidNIM: true,
                  deliveryDays: true,
                  createdAt: true,
                },
              },
            }
          : {}),
      },
      orderBy: sortOrderBy(q.get('sort')),
      take: 100,
    })

    return NextResponse.json(opportunities)
  } catch (error) {
    console.error('List opportunities error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Post an opportunity. It is created as a draft — nothing is public until the
// client commits the budget through the fund route.
export async function POST(request: NextRequest) {
  try {
    const user = await requireSession(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const title = String(body.title ?? '').trim()
    const description = String(body.description ?? '').trim()
    const category = body.category
    const serviceType = String(body.serviceType ?? '').trim()
    const budgetNIM = Number(body.budgetNIM)
    const timelineDays = Number(body.timelineDays)
    const deliverables = sanitizeDeliverables(body.deliverables)
    const attachments = sanitizeAttachments(body.attachments)

    // Each check names the field it rejected — a form that only says "invalid"
    // is unusable on a phone where half the fields are scrolled offscreen.
    const problems: string[] = []
    if (title.length < 4) problems.push('Title must be at least 4 characters')
    if (description.length < 30) problems.push('Description must be at least 30 characters')
    if (!isValidCategory(category)) problems.push('Pick a category')
    if (!serviceType) problems.push('Pick a service type')
    if (!Number.isFinite(budgetNIM) || budgetNIM <= 0) problems.push('Budget must be above 0 NIM')
    if (!Number.isInteger(timelineDays) || timelineDays < 1)
      problems.push('Timeline must be at least 1 day')
    if (deliverables.length === 0) problems.push('List at least one deliverable')

    if (problems.length > 0) {
      return NextResponse.json({ error: problems[0], problems }, { status: 400 })
    }

    const opportunity = await prisma.agreement.create({
      data: {
        title: title.slice(0, 140),
        description: description.slice(0, 8000),
        category,
        serviceType: serviceType.slice(0, 80),
        timelineDays,
        budgetNIM,
        // Escrow amount starts at the full budget and narrows to the accepted
        // bid, which can come in under it.
        amountNIM: budgetNIM,
        // A working deadline so the record is never dateless; it is recomputed
        // from the accepted proposal's delivery time when work actually starts.
        deadline: new Date(Date.now() + timelineDays * 86400000),
        deliverables: JSON.stringify(deliverables),
        attachments: JSON.stringify(attachments),
        completionTerms:
          'The client approves the submitted work, which releases the escrow to the freelancer.',
        refundTerms:
          'If the work is not delivered by the deadline, or a dispute resolves in the client’s favour, the escrow returns to the client at the HTLC timeout.',
        riskFlags: '[]',
        buyerId: user.userId,
        status: 'draft',
      },
      include: { buyer: { select: { id: true, address: true, displayName: true } } },
    })

    return NextResponse.json(opportunity, { status: 201 })
  } catch (error) {
    console.error('Create opportunity error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
