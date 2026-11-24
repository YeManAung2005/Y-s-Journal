import { Outlet } from '@tanstack/react-router'
import { AppShell } from '@/components/app-shell'
import { BrandMark } from '@/components/brand-mark'
import { Button } from '@/components/ui/button'
import { LoginPage } from '@/features/auth/login-page'
import { LockScreen } from '@/features/auth/lock-screen'
import { OnboardingPage } from '@/features/auth/onboarding-page'
import { useAuth } from '@/lib/auth-context'

function Spinner({ className = 'size-4' }) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
      aria-hidden="true"
    />
  )
}

export function AuthGate() {
  const { status, error, retry } = useAuth()

  if (status === 'loading') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4">
        <BrandMark className="size-12" />
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner /> Securing workspace…
        </p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
        <BrandMark className="size-12" />
        <h1 className="text-xl font-semibold">The API is unreachable</h1>
        <p className="max-w-sm text-sm leading-6 text-muted-foreground">
          {error?.message || 'Y’s Journal could not reach its local server.'}
        </p>
        <Button onClick={() => void retry()}>Try again</Button>
      </div>
    )
  }

  if (status === 'setup') return <OnboardingPage />
  if (status === 'unauthenticated') return <LoginPage />
  if (status === 'locked') return <LockScreen />

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}

export { Spinner }
