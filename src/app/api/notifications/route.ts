import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import prisma from '@/lib/db'

// What is waiting for this person, grouped by the tab it belongs under so the
// sidebar can render a count next to the right thing without knowing anything
// about what produced it.
export async function GET(request: NextRequest) {
  try {
    const user = await requireSession(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const grouped = await prisma.notification.groupBy({
      by: ['tab'],
      where: { userId: user.userId, readAt: null },
      _count: { _all: true },
    })

    const counts: Record<string, number> = {}
    for (const row of grouped) counts[row.tab] = row._count._all

    // Read ones included. The counts drive the dots, which have to disappear
    // once somebody has looked; the list is a history, and a history that
    // erases an item the moment it is seen is no use to anyone trying to work
    // out what happened while they were away.
    const rows = await prisma.notification.findMany({
      where: { userId: user.userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        tab: true,
        type: true,
        body: true,
        href: true,
        createdAt: true,
        readAt: true,
      },
    })

    const recent = rows.map(({ readAt, ...row }) => ({ ...row, read: readAt !== null }))

    return NextResponse.json({ counts, recent })
  } catch (error) {
    console.error('List notifications error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Mark read. A tab clears everything under it — opening the page is the act of
// having seen what was waiting there.
export async function POST(request: NextRequest) {
  try {
    const user = await requireSession(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const where: Record<string, unknown> = { userId: user.userId, readAt: null }
    // `all` is explicit on purpose. An empty body used to mean "everything",
    // so any malformed call silently wiped the lot.
    if (body.all !== true) {
      if (typeof body.tab === 'string') where.tab = body.tab
      if (typeof body.agreementId === 'string') where.agreementId = body.agreementId
      if (!where.tab && !where.agreementId) {
        return NextResponse.json(
          { error: 'Name what to mark read: a tab, an agreement, or all.' },
          { status: 400 },
        )
      }
    }

    const { count } = await prisma.notification.updateMany({
      where,
      data: { readAt: new Date() },
    })

    return NextResponse.json({ ok: true, cleared: count })
  } catch (error) {
    console.error('Mark notifications read error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
