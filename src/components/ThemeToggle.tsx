'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/components/ThemeProvider'
import { cn } from '@/lib/utils'

// One control, two states, and it says which one it will give you rather than
// which one you are in: the icon is the destination, and so is the label a
// screen reader reads.
export default function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme()
  const goingTo = theme === 'dark' ? 'light' : 'dark'

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${goingTo} mode`}
      title={`Switch to ${goingTo} mode`}
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-elevate hover:text-foreground',
        className,
      )}
    >
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  )
}
