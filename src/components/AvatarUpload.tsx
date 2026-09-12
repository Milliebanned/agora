'use client'

import { useRef, useState } from 'react'
import { Camera, Trash2 } from 'lucide-react'
import Avatar, { type AvatarPerson } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/page'

/** What the picture is reduced to before it leaves the browser. Square, because
 *  every place it appears is a circle, and 512 because that is enough for the
 *  largest one the app draws on a retina screen and nothing more. */
const SIDE = 512
const QUALITY = 0.82

/** Read from the file rather than trusted from its name. */
const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp']

// Crop to a centred square and scale down, in the browser.
//
// A phone camera photo is several megabytes of a rectangle, and every one of
// them would be stored forever, read on every profile, and cropped to a circle
// at 32 pixels anyway. Doing it here means the network, the database and the
// person on a slow connection all carry a few tens of kilobytes instead.
/** Decodes the file to something drawable. createImageBitmap is the direct
 *  route, but Agora runs inside the Nimiq Pay WebView and older iOS builds do
 *  not have it, so an <img> and an object URL stand in there. */
async function decode(file: File): Promise<{
  source: CanvasImageSource
  width: number
  height: number
  release: () => void
}> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file)
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      release: () => bitmap.close(),
    }
  }

  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('Could not decode that image.'))
      el.src = url
    })
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      release: () => URL.revokeObjectURL(url),
    }
  } catch (err) {
    URL.revokeObjectURL(url)
    throw err
  }
}

async function toSquareDataUrl(file: File): Promise<string> {
  const { source, width, height, release } = await decode(file)
  try {
    const side = Math.min(width, height)
    const sx = (width - side) / 2
    const sy = (height - side) / 2
    // Never scale a small picture up: it would cost bytes and add nothing.
    const out = Math.min(SIDE, side)

    const canvas = document.createElement('canvas')
    canvas.width = out
    canvas.height = out
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('This browser could not process the image.')
    ctx.drawImage(source, sx, sy, side, side, 0, 0, out, out)

    // JPEG for photographs, which is what a profile picture almost always is.
    // A transparent PNG would gain a black background, so those keep PNG.
    const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
    return canvas.toDataURL(type, QUALITY)
  } finally {
    release()
  }
}

export default function AvatarUpload({
  person,
  onChange,
}: {
  person: AvatarPerson
  /** Called with the new timestamp, or null when the picture was removed, so
   *  the page around this can redraw without a round trip. */
  onChange: (avatarUpdatedAt: string | null) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  // What the file looked like locally, shown the instant it is picked so the
  // wait is spent looking at the new picture rather than the old one.
  const [preview, setPreview] = useState<string | null>(null)

  const pick = async (file: File | undefined) => {
    if (!file) return
    setError('')

    if (!ACCEPTED.includes(file.type)) {
      setError('Pictures have to be PNG, JPEG or WebP.')
      return
    }

    setBusy(true)
    try {
      const dataUrl = await toSquareDataUrl(file)
      setPreview(dataUrl)

      const res = await fetch(`/api/users/${person.id}/avatar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ dataUrl }),
      })
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}))
        setPreview(null)
        setError(detail.error ?? 'That picture could not be saved.')
        return
      }
      const { avatarUpdatedAt } = await res.json()
      onChange(avatarUpdatedAt)
    } catch {
      setPreview(null)
      setError('That file could not be read as an image.')
    } finally {
      setBusy(false)
      // Cleared so picking the same file twice still fires a change.
      if (input.current) input.current.value = ''
    }
  }

  const remove = async () => {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/users/${person.id}/avatar`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) {
        setError('That picture could not be removed.')
        return
      }
      setPreview(null)
      onChange(null)
    } catch {
      setError('That picture could not be removed.')
    } finally {
      setBusy(false)
    }
  }

  const hasPicture = Boolean(preview || person.avatarUpdatedAt)

  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        {preview ? (
          <span className="relative flex h-16 w-16 shrink-0 overflow-hidden rounded-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="" className="h-full w-full object-cover" />
          </span>
        ) : (
          <Avatar person={person} size={64} />
        )}

        {busy && (
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-background/70">
            <Spinner className="h-5 w-5" />
          </span>
        )}
      </div>

      <div>
        <input
          ref={input}
          id="avatar-file"
          type="file"
          accept={ACCEPTED.join(',')}
          className="sr-only"
          onChange={(e) => pick(e.target.files?.[0])}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => input.current?.click()}
          >
            <Camera className="h-3.5 w-3.5" />
            {hasPicture ? 'Change picture' : 'Upload a picture'}
          </Button>
          {hasPicture && (
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={remove}>
              <Trash2 className="h-3.5 w-3.5" />
              Remove
            </Button>
          )}
        </div>
        <p className="mt-1.5 text-[12px] text-subtle-foreground">
          Square works best. It is cropped from the middle and shown wherever you appear.
        </p>
        {error && <p className="mt-1.5 text-[12px] text-destructive">{error}</p>}
      </div>
    </div>
  )
}
