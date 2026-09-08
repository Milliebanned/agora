import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-40',
  {
    variants: {
      variant: {
        // The single chromatic element system-wide — reserve for the primary action.
        primary:
          'bg-accent text-accent-foreground rounded-md font-medium hover:brightness-110',
        secondary:
          'bg-transparent border border-border text-secondary-foreground rounded-md font-normal hover:bg-white/[0.04] hover:border-border-strong',
        ghost: 'bg-transparent text-secondary-foreground rounded-md font-normal hover:bg-white/[0.04]',
        pill: 'bg-white/[0.05] text-secondary-foreground rounded-full font-normal hover:bg-white/[0.09]',
        destructive:
          'bg-transparent border border-border text-destructive rounded-md font-normal hover:bg-destructive/10 hover:border-destructive/40',
      },
      size: {
        sm: 'h-7 px-3 text-[13px]',
        default: 'h-9 px-4 text-[14px]',
        lg: 'h-11 px-5 text-[15px]',
        pill: 'h-7 px-3 text-[13px]',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  ),
)
Button.displayName = 'Button'

export { Button, buttonVariants }
