import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wide transition-colors',
  {
    variants: {
      variant: {
        default: 'border-primary/25 bg-primary/10 text-primary',
        secondary: 'border-border bg-secondary text-secondary-foreground',
        success: 'border-success/25 bg-success-muted/60 text-success',
        danger: 'border-danger/25 bg-danger-muted/60 text-danger',
        outline: 'border-border bg-transparent text-muted-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

function Badge({ className, variant, ...props }) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
