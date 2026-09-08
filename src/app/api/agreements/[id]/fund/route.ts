import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken } from '@/lib/auth'
import { randomHex, sha256, nimToSats } from '@/lib/utils'
import prisma from '@/lib/db'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = request.cookies.get('session')?.value
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await verifySessionToken(session)
    if (!user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    const agreement = await prisma.agreement.findUnique({
      where: { id: params.id },
      include: { seller: true },
    })

    if (!agreement) {
      return NextResponse.json({ error: 'Agreement not found' }, { status: 404 })
    }

    // Only buyer can fund
    if (agreement.buyerId !== user.userId) {
      return NextResponse.json({ error: 'Only buyer can fund escrow' }, { status: 403 })
    }

    // Agreement must have a seller
    if (!agreement.sellerId) {
      return NextResponse.json({ error: 'Seller not yet assigned' }, { status: 400 })
    }

    // Already funded?
    if (agreement.htlcAddress) {
      return NextResponse.json({ error: 'Escrow already funded' }, { status: 400 })
    }

    // Generate release secret + hash
    const preImage = randomHex(32)
    const hashRoot = await sha256(preImage)

    // Calculate HTLC timeout (current block + configured timeout blocks)
    // TODO: Get current block height from Nimiq SDK
    const timeoutBlocks = parseInt(process.env.HTLC_TIMEOUT_BLOCKS || '14400')
    const currentBlock = 1 // Placeholder - will be fetched from SDK in real implementation
    const htlcTimeout = currentBlock + timeoutBlocks

    // Build HTLC creation data (Nimiq protocol format)
    // This is a simplified representation; actual format is lower-level
    const htlcData = {
      type: 2, // HTLC account type
      sender: user.userId, // Buyer (funds provider)
      recipient: agreement.sellerId, // Seller (funds recipient)
      balance: nimToSats(agreement.amountNIM),
      hash_root: hashRoot,
      hash_algorithm: 3, // SHA256
      hash_count: 1,
      timeout: htlcTimeout,
    }

    // Create unsigned transaction (client-side, in browser)
    // TODO: SDK will build actual Tx structure
    // For now, store the pre-image and hash, wait for actual SDK integration

    // Store HTLC details in DB
    const updated = await prisma.agreement.update({
      where: { id: params.id },
      data: {
        htlcHashRoot: hashRoot,
        htlcPreImage: preImage, // Store securely (in production, this should be encrypted/in secure storage)
        htlcTimeout: htlcTimeout,
        status: 'active', // Mark agreement as active once escrow is prepared
      },
    })

    // Create pending escrow transaction
    await prisma.escrowTransaction.create({
      data: {
        agreementId: params.id,
        type: 'fund',
        status: 'pending',
        // txHash will be set after blockchain confirmation
      },
    })

    // Add system message
    await prisma.message.create({
      data: {
        agreementId: params.id,
        senderId: user.userId,
        type: 'system',
        content: `Escrow funding initiated: ${agreement.amountNIM} NIM locked`,
      },
    })

    return NextResponse.json({
      message: 'Escrow funding prepared. Sign transaction in Nimiq Pay.',
      htlcData,
      agreement: updated,
    })
  } catch (error) {
    console.error('Fund escrow error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
