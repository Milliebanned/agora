import * as React from 'react'
import { cn } from '@/lib/utils'

const fieldStyles =
  'w-full bg-white/[0.02] border border-white/[0.08] rounded-md px-3.5 py-3 text-[14px] text-foreground placeholder:text-subtle-foreground transition-colors focus:outline-none focus:border-accent/50 focus:bg-white/[0.03] disabled:opacity-40'

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(fieldStyles, className)} {...props} />
  ),
)
Input.displayName = 'Input'

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(fieldStyles, 'resize-y leading-relaxed', className)} {...props} />
))
Textarea.displayName = 'Textarea'

// Native select on purpose: the Nimiq Pay WebView renders the platform picker,
// which beats any custom dropdown on a phone.
export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      fieldStyles,
      'cursor-pointer appearance-none bg-[right_0.75rem_center] bg-no-repeat pr-9',
      className,
    )}
    style={{
      backgroundImage:
        "url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='m4 6 4 4 4-4'/%3E%3C/svg%3E\")",
    }}
    {...props}
  />
))
Select.displayName = 'Select'
