import { useState } from 'react'
import { LogOut, LockKeyhole } from 'lucide-react'
import { BrandMark } from '@/components/brand-mark'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/lib/auth-context'

export function LockScreen() {
  const { user, unlock, signOut } = useAuth()
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(event) {
    event.preventDefault()
    setError(null)
    setPending(true)
    try {
      await unlock(password)
      setPassword('')
    } catch (submitError) {
      setError(submitError.message || 'Unlock failed.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm text-center">
        <div className="mb-5 flex justify-center">
          <BrandMark className="size-12" />
        </div>
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
          Workspace locked
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Welcome back{user?.displayName ? `, ${user.displayName}` : ''}
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Locked after 15 minutes of inactivity. Enter your password to continue.
        </p>

        <form className="mt-6 space-y-4 text-left" onSubmit={onSubmit} noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="unlock-password">Password</Label>
            <Input
              id="unlock-password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoFocus
              required
            />
          </div>

          {error ? (
            <div
              role="alert"
              className="rounded-lg border border-danger/30 bg-danger-muted/40 px-3 py-2 text-sm text-danger"
            >
              {error}
            </div>
          ) : null}

          <Button type="submit" className="w-full" disabled={pending}>
            <LockKeyhole aria-hidden="true" />
            {pending ? 'Unlocking…' : 'Unlock workspace'}
          </Button>
        </form>

        <Button variant="ghost" className="mt-3 w-full" onClick={() => void signOut()}>
          <LogOut aria-hidden="true" />
          Sign out instead
        </Button>
      </div>
    </div>
  )
}
