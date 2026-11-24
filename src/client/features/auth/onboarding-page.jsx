import { useMemo, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { AuthLayout, FormError } from '@/features/auth/auth-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/lib/auth-context'

function requirementList(form) {
  return [
    { label: 'At least 12 characters', met: form.password.length >= 12 },
    { label: 'Includes a letter', met: /[A-Za-z]/.test(form.password) },
    { label: 'Includes a number', met: /[0-9]/.test(form.password) },
    {
      label: 'Passwords match',
      met: form.password.length > 0 && form.password === form.confirmPassword,
    },
  ]
}

export function OnboardingPage() {
  const { completeOnboarding } = useAuth()
  const [form, setForm] = useState({
    email: '',
    displayName: '',
    password: '',
    confirmPassword: '',
  })
  const [error, setError] = useState(null)
  const [pending, setPending] = useState(false)

  const requirements = useMemo(() => requirementList(form), [form])
  const ready =
    requirements.every((item) => item.met) && form.email.trim() && form.displayName.trim()

  function update(field) {
    return (event) => setForm((current) => ({ ...current, [field]: event.target.value }))
  }

  async function onSubmit(event) {
    event.preventDefault()
    setError(null)

    if (!ready) {
      setError('Complete every password requirement before continuing.')
      return
    }

    setPending(true)
    try {
      await completeOnboarding(form)
    } catch (submitError) {
      setError(submitError.message || 'The owner account could not be created.')
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthLayout
      title="Create the owner account"
      description="This is a one-time setup. The account exists only on this laptop and cannot be registered again."
      footer="Passwords are hashed with Argon2id. Your passphrase is never stored in plain text."
    >
      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="displayName">Display name</Label>
          <Input
            id="displayName"
            name="displayName"
            autoComplete="name"
            maxLength={80}
            value={form.displayName}
            onChange={update('displayName')}
            placeholder="How should Y's Journal address you?"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            value={form.email}
            onChange={update('email')}
            placeholder="you@example.com"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={update('password')}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={form.confirmPassword}
            onChange={update('confirmPassword')}
            required
          />
        </div>

        <ul className="grid grid-cols-2 gap-2 rounded-lg border border-border/70 bg-secondary/30 p-3">
          {requirements.map((item) => (
            <li
              key={item.label}
              className={`flex items-center gap-2 text-[11px] ${
                item.met ? 'text-success' : 'text-muted-foreground'
              }`}
            >
              <span
                className={`size-1.5 rounded-full ${item.met ? 'bg-success' : 'bg-muted-foreground/50'}`}
                aria-hidden="true"
              />
              {item.label}
            </li>
          ))}
        </ul>

        <FormError>{error}</FormError>

        <Button type="submit" className="w-full" disabled={pending}>
          <ShieldCheck aria-hidden="true" />
          {pending ? 'Creating secure account…' : 'Create owner account'}
        </Button>
      </form>
    </AuthLayout>
  )
}
