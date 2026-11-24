import { BrandMark } from '@/components/brand-mark'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function AuthLayout({ title, description, children, footer }) {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
      <div
        className="pointer-events-none absolute left-1/2 top-0 size-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl"
        aria-hidden="true"
      />
      <div className="relative w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <BrandMark />
          <div>
            <p className="text-sm font-semibold tracking-tight">Y&apos;s Journal</p>
            <p className="text-[11px] text-muted-foreground">Private workspace</p>
          </div>
        </div>

        <Card className="border-border/80 bg-card/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-xl tracking-tight">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>

        {footer ? (
          <p className="mt-5 text-center text-xs leading-relaxed text-muted-foreground">{footer}</p>
        ) : null}
      </div>
    </div>
  )
}

export function FormError({ children }) {
  if (!children) return null
  return (
    <div
      role="alert"
      className="rounded-lg border border-danger/30 bg-danger-muted/40 px-3 py-2 text-sm text-danger"
    >
      {children}
    </div>
  )
}
