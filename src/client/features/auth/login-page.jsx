import { useState } from 'react'
import { LogIn } from 'lucide-react'
import { AuthLayout, FormError } from '@/features/auth/auth-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/lib/auth-context'

export function LoginPage() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(event) {
    event.preventDefault()
    setError(null)
    setPending(true)
    try {
      await signIn({ email, password })
    } catch (submitError) {
      setError(submitError.message || 'Sign-in failed.')
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthLayout
      title="Unlock your workspace"
      description="Sign in with the owner account for this laptop."
      footer="Sessions expire after 7 days of inactivity. The workspace locks after 15 minutes."
    >
      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoFocus
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>

        <FormError>{error}</FormError>

        <Button type="submit" className="w-full" disabled={pending}>
          <LogIn aria-hidden="true" />
          {pending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </AuthLayout>
  )
}
