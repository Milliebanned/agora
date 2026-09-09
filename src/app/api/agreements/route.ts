import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import prisma from '@/lib/db'

// Every opportunity this user is a party to, on either side of the deal. The
// public board lives at /api/opportunities; this is the private ledger behind
// the Deals page.
export async function GET(request: NextRequest) {
  try {
    const user = await requireSession(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const status = request.nextUrl.searchParams.get('status')

    const agreements = await prisma.agreement.findMany({
      where: {
        OR: [{ buyerId: user.userId }, { sellerId: user.userId }],
        ...(status && { status: status as any }),
      },
      include: {
        buyer: { select: { id: true, address: true, displayName: true } },
        seller: { select: { id: true, address: true, displayName: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    // The release secret never rides along in a list payload — it is handed to
    // the freelancer through the claim route and nowhere else.
    return NextResponse.json(
      agreements.map(({ htlcPreImage, ...rest }) => rest),
    )
  } catch (error) {
    console.error('Get agreements error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
