import { useEffect, useMemo, useState } from 'react'
import { Clock, Globe, KeyRound, LogOut, Palette, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiRequest } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'

const TIME_ZONES = [
  'UTC',
  'Asia/Yangon',
  'Asia/Bangkok',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Asia/Kolkata',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Australia/Sydney',
]

const EVENT_LABELS = {
  login_success: 'Signed in',
  login_failed: 'Failed sign-in',
  logout: 'Signed out',
  unlock_success: 'Workspace unlocked',
  unlock_failed: 'Failed unlock',
  password_changed: 'Password changed',
  onboarding_completed: 'Owner account created',
  rate_limited: 'Request rate limited',
  csrf_rejected: 'Blocked unverified request',
  session_expired: 'Session expired',
  access_denied: 'Access denied',
}

function Section({ icon: Icon, title, description, children }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-primary" aria-hidden="true" />
          <CardTitle>{title}</CardTitle>
        </div>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  )
}

function FieldRow({ label, hint, children }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      <div className="sm:w-64">{children}</div>
    </div>
  )
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
    date,
  )
}

function toForm(settings) {
  return {
    theme: settings?.theme ?? 'dark',
    fontScale: settings?.fontScale ?? 1,
    reducedMotion: settings?.reducedMotion ?? false,
    appTimeZone: settings?.appTimeZone ?? 'Asia/Yangon',
    tradingTimeZone: settings?.tradingTimeZone ?? 'America/New_York',
    dailyStudyTargetMinutes: settings?.dailyStudyTargetMinutes ?? 60,
  }
}

export function SettingsPage() {
  const { user, settings, session, saveSettings, lock, signOut, changePassword } = useAuth()
  const [form, setForm] = useState(() => toForm(settings))
  const [status, setStatus] = useState(null)
  const [saving, setSaving] = useState(false)
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: '',
  })
  const [passwordStatus, setPasswordStatus] = useState(null)
  const [passwordPending, setPasswordPending] = useState(false)
  const [events, setEvents] = useState([])
  const [eventsError, setEventsError] = useState(null)

  useEffect(() => {
    let active = true
    apiRequest('/security/events?limit=20')
      .then((data) => {
        if (active) setEvents(data.events)
      })
      .catch((error) => {
        if (active) setEventsError(error.message)
      })
    return () => {
      active = false
    }
  }, [])

  const dense = useMemo(() => new Set(TIME_ZONES), [])

  if (!settings) return null

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    setStatus(null)
  }

  async function onSave(event) {
    event.preventDefault()
    setSaving(true)
    setStatus(null)
    try {
      const updated = await saveSettings({
        theme: form.theme,
        fontScale: Number(form.fontScale),
        reducedMotion: form.reducedMotion,
        appTimeZone: form.appTimeZone,
        tradingTimeZone: form.tradingTimeZone,
        dailyStudyTargetMinutes: Number(form.dailyStudyTargetMinutes),
      })
      setForm(toForm(updated))
      setStatus({ type: 'success', message: 'Settings saved.' })
    } catch (error) {
      setStatus({ type: 'error', message: error.message || 'Settings could not be saved.' })
    } finally {
      setSaving(false)
    }
  }

  async function onPasswordChange(event) {
    event.preventDefault()
    setPasswordPending(true)
    setPasswordStatus(null)
    try {
      await changePassword(passwordForm)
      setPasswordForm({ currentPassword: '', newPassword: '', confirmNewPassword: '' })
      setPasswordStatus({
        type: 'success',
        message: 'Password changed. Other sessions were signed out.',
      })
    } catch (error) {
      setPasswordStatus({ type: 'error', message: error.message || 'Password change failed.' })
    } finally {
      setPasswordPending(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-primary">Settings</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Workspace preferences</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Signed in as {user?.displayName} ({user?.email}). Preferences apply to this owner account.
        </p>
      </div>

      <form className="grid gap-4 lg:grid-cols-2" onSubmit={onSave}>
        <Section
          icon={Palette}
          title="Appearance"
          description="Theme, text size, and motion preferences."
        >
          <FieldRow label="Theme" hint="System follows your Windows setting.">
            <select
              className="h-10 w-full rounded-lg border border-input bg-background/50 px-3 text-sm focus-visible:border-ring focus-visible:outline-none"
              value={form.theme}
              onChange={(event) => update('theme', event.target.value)}
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="system">System</option>
            </select>
          </FieldRow>

          <FieldRow label="Text size" hint={`${Math.round(form.fontScale * 100)}% of default`}>
            <input
              type="range"
              min="0.8"
              max="1.5"
              step="0.05"
              value={form.fontScale}
              onChange={(event) => update('fontScale', event.target.value)}
              className="w-full accent-[var(--primary)]"
            />
          </FieldRow>

          <label className="flex items-center justify-between gap-4 rounded-lg border border-border/70 bg-secondary/30 p-3">
            <span>
              <span className="block text-sm font-medium">Reduce motion</span>
              <span className="block text-xs text-muted-foreground">
                Minimize animations and transitions.
              </span>
            </span>
            <input
              type="checkbox"
              checked={form.reducedMotion}
              onChange={(event) => update('reducedMotion', event.target.checked)}
              className="size-4 accent-[var(--primary)]"
            />
          </label>
        </Section>

        <Section
          icon={Globe}
          title="Time and goals"
          description="App dates use the app time zone. Trades use the trading time zone."
        >
          <FieldRow label="App time zone" hint="Journal and learning dates.">
            <select
              className="h-10 w-full rounded-lg border border-input bg-background/50 px-3 text-sm focus-visible:border-ring focus-visible:outline-none"
              value={form.appTimeZone}
              onChange={(event) => update('appTimeZone', event.target.value)}
            >
              {(dense.has(form.appTimeZone) ? TIME_ZONES : [form.appTimeZone, ...TIME_ZONES]).map(
                (zone) => (
                  <option key={zone} value={zone}>
                    {zone}
                  </option>
                ),
              )}
            </select>
          </FieldRow>

          <FieldRow label="Trading time zone" hint="Session and trade dates.">
            <select
              className="h-10 w-full rounded-lg border border-input bg-background/50 px-3 text-sm focus-visible:border-ring focus-visible:outline-none"
              value={form.tradingTimeZone}
              onChange={(event) => update('tradingTimeZone', event.target.value)}
            >
              {(dense.has(form.tradingTimeZone)
                ? TIME_ZONES
                : [form.tradingTimeZone, ...TIME_ZONES]
              ).map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </select>
          </FieldRow>

          <FieldRow label="Daily study target" hint="Minutes per day.">
            <Input
              type="number"
              min="0"
              max="720"
              step="5"
              value={form.dailyStudyTargetMinutes}
              onChange={(event) => update('dailyStudyTargetMinutes', event.target.value)}
            />
          </FieldRow>

          <div className="flex items-center justify-between gap-3 pt-1">
            {status ? (
              <p
                role="status"
                className={`text-xs ${status.type === 'success' ? 'text-success' : 'text-danger'}`}
              >
                {status.message}
              </p>
            ) : (
              <span />
            )}
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? 'Saving…' : 'Save preferences'}
            </Button>
          </div>
        </Section>
      </form>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section
          icon={ShieldCheck}
          title="Session security"
          description="One owner session, protected by a secure cookie."
        >
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-secondary/30 p-3">
            <div>
              <p className="text-sm font-medium">Current session</p>
              <p className="text-xs text-muted-foreground">
                Expires {formatDate(session?.expiresAt)}
              </p>
            </div>
            <Badge variant="success">Active</Badge>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={lock}>
              <Clock aria-hidden="true" />
              Lock now
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => void signOut()}>
              <LogOut aria-hidden="true" />
              Sign out
            </Button>
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground">
            The workspace locks automatically after 15 minutes of inactivity. Sessions expire after
            7 days without activity.
          </p>
        </Section>

        <Section
          icon={KeyRound}
          title="Change password"
          description="Other sessions are signed out after a password change."
        >
          <form className="space-y-3" onSubmit={onPasswordChange} noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="currentPassword">Current password</Label>
              <Input
                id="currentPassword"
                type="password"
                autoComplete="current-password"
                value={passwordForm.currentPassword}
                onChange={(event) =>
                  setPasswordForm((current) => ({
                    ...current,
                    currentPassword: event.target.value,
                  }))
                }
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="newPassword">New password</Label>
              <Input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                value={passwordForm.newPassword}
                onChange={(event) =>
                  setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirmNewPassword">Confirm new password</Label>
              <Input
                id="confirmNewPassword"
                type="password"
                autoComplete="new-password"
                value={passwordForm.confirmNewPassword}
                onChange={(event) =>
                  setPasswordForm((current) => ({
                    ...current,
                    confirmNewPassword: event.target.value,
                  }))
                }
                required
              />
            </div>

            {passwordStatus ? (
              <p
                role="status"
                className={`text-xs ${
                  passwordStatus.type === 'success' ? 'text-success' : 'text-danger'
                }`}
              >
                {passwordStatus.message}
              </p>
            ) : null}

            <Button type="submit" size="sm" disabled={passwordPending}>
              {passwordPending ? 'Updating…' : 'Update password'}
            </Button>
          </form>
        </Section>
      </div>

      <Section
        icon={ShieldCheck}
        title="Security activity"
        description="Recent authentication and security events for this workspace."
      >
        {eventsError ? (
          <p className="text-xs text-danger">{eventsError}</p>
        ) : events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No security events recorded yet.</p>
        ) : (
          <ul className="divide-y divide-border/70">
            {events.map((event) => (
              <li key={event.id} className="flex items-start justify-between gap-3 py-2.5">
                <div>
                  <p className="text-sm">{EVENT_LABELS[event.type] ?? event.type}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {event.ip || 'local'} · {formatDate(event.createdAt)}
                  </p>
                </div>
                <Badge variant={event.type.endsWith('failed') ? 'danger' : 'outline'}>
                  {event.type}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  )
}
