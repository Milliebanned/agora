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

    const recent = await prisma.notification.findMany({
      where: { userId: user.userId, readAt: null },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, tab: true, type: true, body: true, href: true, createdAt: true },
    })

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
    if (typeof body.tab === 'string') where.tab = body.tab
    if (typeof body.agreementId === 'string') where.agreementId = body.agreementId

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
