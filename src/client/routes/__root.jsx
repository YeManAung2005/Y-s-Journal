import { Link, Outlet, createRootRoute } from '@tanstack/react-router'
import { AppShell } from '@/components/app-shell'
import { Button } from '@/components/ui/button'

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
})

function RootComponent() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}

function NotFoundComponent() {
  return (
    <div className="mx-auto max-w-lg py-20 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.24em] text-primary">404</p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        This route does not exist yet. It may be planned for a later phase.
      </p>
      <Button asChild className="mt-6">
        <Link to="/">Return to overview</Link>
      </Button>
    </div>
  )
}
