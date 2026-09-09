import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken } from '@/lib/auth'
import prisma from '@/lib/db'
import { generateAgreement } from '@/lib/gemini'
import { sha256, randomHex, parseJsonArray } from '@/lib/utils'

export async function GET(request: NextRequest) {
  try {
    const session = request.cookies.get('session')?.value
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await verifySessionToken(session)
    if (!user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
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

    return NextResponse.json(agreements)
  } catch (error) {
    console.error('Get agreements error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = request.cookies.get('session')?.value
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await verifySessionToken(session)
    if (!user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    const { title, description, amountNIM, deadline, deliverables, completionTerms, refundTerms, riskFlags } = await request.json()

    if (!title || !description || !amountNIM || !deadline) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Create agreement
    const agreement = await prisma.agreement.create({
      data: {
        title,
        description,
        amountNIM: parseFloat(amountNIM.toString()),
        deadline: new Date(deadline),
        deliverables: JSON.stringify(deliverables || []),
        completionTerms: completionTerms || '',
        refundTerms: refundTerms || '',
        riskFlags: JSON.stringify(riskFlags || []),
        buyerId: user.userId,
        status: 'draft',
      },
      include: {
        buyer: { select: { id: true, address: true, displayName: true } },
      },
    })

    return NextResponse.json(agreement, { status: 201 })
  } catch (error) {
    console.error('Create agreement error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
