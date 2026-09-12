import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import prisma from '@/lib/db'
import { isValidCategory } from '@/lib/opportunities'

// One advertisement. Readable by any signed-in user when it is published,
// because that is the whole point of it; editable only by whoever wrote it.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSession(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const listing = await prisma.serviceListing.findUnique({
      where: { id },
      include: {
        provider: {
          select: {
            id: true,
            address: true,
            displayName: true,
            bio: true,
            reputationScores: { select: { trustScore: true, completedAgreements: true } },
          },
        },
      },
    })

    if (!listing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (listing.status !== 'published' && listing.providerId !== user.userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json(listing)
  } catch (error) {
    console.error('Get service listing error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSession(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const listing = await prisma.serviceListing.findUnique({ where: { id } })
    if (!listing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (listing.providerId !== user.userId) {
      return NextResponse.json({ error: 'This is not your advertisement' }, { status: 403 })
    }

    const body = await request.json()
    const data: Record<string, unknown> = {}

    if (body.status !== undefined) {
      if (!['published', 'paused'].includes(body.status)) {
        return NextResponse.json({ error: 'Status must be published or paused' }, { status: 400 })
      }
      data.status = body.status
    }

    if (body.title !== undefined) {
      const title = String(body.title).trim()
      if (title.length < 4)
        return NextResponse.json({ error: 'Title must be at least 4 characters' }, { status: 400 })
      data.title = title.slice(0, 140)
    }

    if (body.description !== undefined) {
      const description = String(body.description).trim()
      if (description.length < 30)
        return NextResponse.json(
          { error: 'Description must be at least 30 characters' },
          { status: 400 },
        )
      data.description = description.slice(0, 4000)
    }

    if (body.category !== undefined) {
      if (!isValidCategory(body.category))
        return NextResponse.json({ error: 'Pick a category' }, { status: 400 })
      data.category = body.category
    }

    if (body.serviceType !== undefined) {
      data.serviceType = String(body.serviceType).trim().slice(0, 80) || null
    }

    if (body.priceNIM !== undefined) {
      const priceNIM = Number(body.priceNIM)
      if (!Number.isFinite(priceNIM) || priceNIM <= 0)
        return NextResponse.json({ error: 'Price must be above 0 NIM' }, { status: 400 })
      data.priceNIM = priceNIM
    }

    if (body.deliveryDays !== undefined) {
      const deliveryDays = Number(body.deliveryDays)
      if (!Number.isInteger(deliveryDays) || deliveryDays < 1)
        return NextResponse.json(
          { error: 'Delivery time must be at least 1 day' },
          { status: 400 },
        )
      data.deliveryDays = deliveryDays
    }

    const updated = await prisma.serviceListing.update({ where: { id }, data })
    return NextResponse.json(updated)
  } catch (error) {
    console.error('Update service listing error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSession(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const listing = await prisma.serviceListing.findUnique({ where: { id } })
    if (!listing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (listing.providerId !== user.userId) {
      return NextResponse.json({ error: 'This is not your advertisement' }, { status: 403 })
    }

    // An advertisement can be pulled down at any time — unless work is
    // actually running because of it. A live deal keeps its own record of what
    // was agreed, but the ad is the only description of what was offered, and
    // deleting it mid-job removes the one thing either party could point at.
    const live = await prisma.agreement.count({
      where: {
        sourceListingId: id,
        status: { in: ['locked', 'submitted', 'completed', 'disputed'] },
      },
    })
    if (live > 0) {
      return NextResponse.json(
        {
          error: `${live} deal${live > 1 ? 's' : ''} from this advertisement ${live > 1 ? 'are' : 'is'} still running. Take it off the board instead — it stops new clients finding it without touching work already under way.`,
          liveDeals: live,
        },
        { status: 409 },
      )
    }

    await prisma.serviceListing.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Delete service listing error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
