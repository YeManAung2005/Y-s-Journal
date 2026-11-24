import { createRootRoute } from '@tanstack/react-router'
import { AuthGate } from '@/features/auth/auth-gate'

export const Route = createRootRoute({
  component: AuthGate,
  notFoundComponent: NotFoundComponent,
})

function NotFoundComponent() {
  return (
    <div className="mx-auto max-w-lg py-20 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.24em] text-primary">404</p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        This route does not exist yet. It may be planned for a later phase.
      </p>
    </div>
  )
}
