import { cn } from '@/lib/utils'

// Something arrived under this tab and nobody has looked at it yet.
//
// A dot rather than a count: a tab in a phone bar is too small to read a
// number on, and by the time there are three of anything the exact figure has
// stopped mattering. Red rather than the brand green, because this is the one
// mark on the dashboard that is asking to be interrupted for, and green is
// what everything else here already is.
//
// The ring is painted in the page's own background so the dot reads as sitting
// on top of an icon rather than being part of it.
export default function UnreadDot({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('block h-2.5 w-2.5 rounded-full bg-[#eb5757] ring-2 ring-background', className)}
    />
  )
}
