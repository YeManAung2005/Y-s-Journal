import { cn } from '@/lib/utils'

export function BrandMark({ className }) {
  return (
    <div
      className={cn(
        'relative grid size-9 place-items-center overflow-hidden rounded-xl border border-primary/30 bg-primary/10 text-sm font-semibold text-primary shadow-[0_0_28px_-10px_var(--primary)]',
        className,
      )}
      aria-hidden="true"
    >
      <span className="absolute inset-0 bg-[linear-gradient(135deg,rgb(255_255_255/0.14),transparent_45%)]" />
      <span className="relative -translate-y-px font-mono">Y</span>
    </div>
  )
}
