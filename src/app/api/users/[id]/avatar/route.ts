import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import prisma from '@/lib/db'

export const runtime = 'nodejs'

// The one route that touches a profile picture.
//
// Reading is public: a picture is the public half of an identity, shown beside
// proposals and advertisements to people who are not signed in as anybody in
// particular. Writing is the owner alone.

/** What a browser will actually display, and nothing that can carry script.
 *  SVG is deliberately absent: it is a document, not an image, and an SVG
 *  avatar is a script running under our origin. */
const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/webp'])

/** Roughly 400KB of image. The client crops to a square and scales to 512px
 *  before sending, which lands well under this; the cap is here for anything
 *  that does not go through our own form. */
const MAX_BYTES = 400_000

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const avatar = await prisma.avatar.findUnique({ where: { userId: id } })
    if (!avatar) {
      return NextResponse.json({ error: 'No picture' }, { status: 404 })
    }

    const body = Buffer.from(avatar.data, 'base64')
    return new NextResponse(body, {
      headers: {
        'Content-Type': avatar.mimeType,
        'Content-Length': String(body.byteLength),
        // Safe to cache hard because every URL carries the picture's own
        // updated-at as a query string. A new picture is a new URL.
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error) {
    console.error('Get avatar error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const session = await requireSession(request)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.userId !== id) {
      return NextResponse.json({ error: 'That is not your profile' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const dataUrl = typeof body.dataUrl === 'string' ? body.dataUrl : ''
    const match = /^data:([a-z/+.-]+);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl)
    if (!match) {
      return NextResponse.json(
        { error: 'Send the picture as a base64 data URL.' },
        { status: 400 },
      )
    }

    const [, mimeType, base64] = match
    if (!ALLOWED.has(mimeType)) {
      return NextResponse.json(
        { error: 'Pictures have to be PNG, JPEG or WebP.' },
        { status: 400 },
      )
    }

    const bytes = Buffer.from(base64, 'base64').byteLength
    if (bytes === 0) {
      return NextResponse.json({ error: 'That file was empty.' }, { status: 400 })
    }
    if (bytes > MAX_BYTES) {
      return NextResponse.json(
        { error: 'That picture is too large. Try one under 400KB.' },
        { status: 413 },
      )
    }

    // The image and the marker on the user go in together. A picture stored
    // without the timestamp would be invisible to every screen in the app,
    // and a timestamp without the picture would draw a broken image
    // everywhere somebody appears.
    const updatedAt = new Date()
    await prisma.$transaction([
      prisma.avatar.upsert({
        where: { userId: id },
        create: { userId: id, mimeType, data: base64, bytes, updatedAt },
        update: { mimeType, data: base64, bytes, updatedAt },
      }),
      prisma.user.update({ where: { id }, data: { avatarUpdatedAt: updatedAt } }),
    ])

    return NextResponse.json({ ok: true, avatarUpdatedAt: updatedAt.toISOString() })
  } catch (error) {
    console.error('Set avatar error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const session = await requireSession(request)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.userId !== id) {
      return NextResponse.json({ error: 'That is not your profile' }, { status: 403 })
    }

    await prisma.$transaction([
      prisma.avatar.deleteMany({ where: { userId: id } }),
      prisma.user.update({ where: { id }, data: { avatarUpdatedAt: null } }),
    ])

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Remove avatar error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
