import { cn, shortAddress } from '@/lib/utils'

export interface AvatarPerson {
  id: string
  displayName?: string | null
  address?: string | null
  /** Null, or absent, means this person has no picture and gets initials. */
  avatarUpdatedAt?: string | Date | null
}

/** Where a person's picture lives. The timestamp is the cache key: the route
 *  serves the image as immutable for a year, so a new picture has to arrive as
 *  a new URL or nobody would ever see it change. */
export function avatarUrl(person: AvatarPerson): string | null {
  if (!person.avatarUpdatedAt) return null
  const stamp = new Date(person.avatarUpdatedAt).getTime()
  return `/api/users/${person.id}/avatar?v=${stamp}`
}

/** The letter somebody gets before they upload anything. Falls back through
 *  name, then address, so it is never the same placeholder letter for
 *  everybody who has not filled in a profile. */
export function initialFor(person: AvatarPerson): string {
  const name = person.displayName?.trim()
  if (name) return name.charAt(0).toUpperCase()
  const address = person.address?.replace(/\s+/g, '') ?? ''
  // Every Nimiq address starts "NQ", which tells two people apart not at all,
  // so take the first character that actually varies.
  return (address.slice(2, 3) || 'A').toUpperCase()
}

export function displayNameFor(person: AvatarPerson): string {
  return person.displayName?.trim() || (person.address ? shortAddress(person.address) : 'Someone')
}

// One person, drawn the same way everywhere they appear.
//
// A picture when there is one, their initial on the brand green when there is
// not. Both are the same circle at the same size, so a list of proposals does
// not change shape depending on who has got round to uploading something.
export default function Avatar({
  person,
  size = 32,
  className,
}: {
  person: AvatarPerson
  /** Pixels. The text scales with it so a large avatar is not a small letter
   *  in a big circle. */
  size?: number
  className?: string
}) {
  const src = avatarUrl(person)
  const name = displayNameFor(person)

  return (
    <span
      className={cn(
        'relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent font-medium text-accent-foreground',
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name}
          width={size}
          height={size}
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span aria-hidden="true">{initialFor(person)}</span>
      )}
    </span>
  )
}
