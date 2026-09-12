import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import prisma from '@/lib/db'
import { isValidCategory } from '@/lib/opportunities'

// Freelancer advertisements. This is the other side of /api/opportunities: a
// client posts work they need done, a freelancer posts work they will do.
//
// Nothing here touches escrow. An advertisement is a claim about what someone
// offers, not a commitment by anyone, so it carries no money and creates no
// obligations. Hiring still goes through a funded Agreement.
export async function GET(request: NextRequest) {
  try {
    const user = await requireSession(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const q = request.nextUrl.searchParams
    const scope = q.get('scope')
    const category = q.get('category')

    const where: Record<string, unknown> =
      scope === 'mine'
        ? // Your own list, paused ones included — they are still yours.
          { providerId: user.userId }
        : { status: 'published' }

    if (isValidCategory(category)) where.category = category

    const sort = q.get('sort')
    const orderBy =
      sort === 'price_low'
        ? { priceNIM: 'asc' as const }
        : sort === 'price_high'
          ? { priceNIM: 'desc' as const }
          : sort === 'delivery_fast'
            ? { deliveryDays: 'asc' as const }
            : { createdAt: 'desc' as const }

    const listings = await prisma.serviceListing.findMany({
      where,
      include: {
        provider: {
          select: {
            id: true,
            address: true,
            displayName: true,
            bio: true,
            // Shown next to the price: what someone charges means little
            // without what they have delivered before.
            reputationScores: { select: { trustScore: true, completedAgreements: true } },
          },
        },
      },
      orderBy,
      take: 100,
    })

    // Only on your own list: how much work each advertisement actually
    // produced, and whether any of it is still running (which is what stops a
    // deletion). A browsing client has no business seeing either.
    if (scope === 'mine' && listings.length > 0) {
      const deals = await prisma.agreement.groupBy({
        by: ['sourceListingId', 'status'],
        where: { sourceListingId: { in: listings.map((l) => l.id) } },
        _count: { _all: true },
      })
      const LIVE = new Set(['locked', 'submitted', 'completed', 'disputed'])
      const stats = new Map<string, { deals: number; liveDeals: number }>()
      for (const row of deals) {
        const key = row.sourceListingId as string
        const at = stats.get(key) ?? { deals: 0, liveDeals: 0 }
        at.deals += row._count._all
        if (LIVE.has(row.status)) at.liveDeals += row._count._all
        stats.set(key, at)
      }
      return NextResponse.json(
        listings.map((l) => ({ ...l, ...(stats.get(l.id) ?? { deals: 0, liveDeals: 0 }) })),
      )
    }

    return NextResponse.json(listings)
  } catch (error) {
    console.error('List service listings error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireSession(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const title = String(body.title ?? '').trim()
    const description = String(body.description ?? '').trim()
    const category = body.category
    const serviceType = String(body.serviceType ?? '').trim()
    const priceNIM = Number(body.priceNIM)
    const deliveryDays = Number(body.deliveryDays)

    // Each check names the field it rejected, so a form on a phone can point at
    // the thing that is wrong instead of just saying no.
    const problems: string[] = []
    if (title.length < 4) problems.push('Title must be at least 4 characters')
    if (description.length < 30) problems.push('Description must be at least 30 characters')
    if (!isValidCategory(category)) problems.push('Pick a category')
    if (!Number.isFinite(priceNIM) || priceNIM <= 0) problems.push('Price must be above 0 NIM')
    if (!Number.isInteger(deliveryDays) || deliveryDays < 1)
      problems.push('Delivery time must be at least 1 day')

    if (problems.length > 0) {
      return NextResponse.json({ error: problems[0], problems }, { status: 400 })
    }

    const listing = await prisma.serviceListing.create({
      data: {
        providerId: user.userId,
        title: title.slice(0, 140),
        description: description.slice(0, 4000),
        category,
        serviceType: serviceType.slice(0, 80) || null,
        priceNIM,
        deliveryDays,
        status: 'published',
      },
    })

    return NextResponse.json(listing, { status: 201 })
  } catch (error) {
    console.error('Create service listing error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
