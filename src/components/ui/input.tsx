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
