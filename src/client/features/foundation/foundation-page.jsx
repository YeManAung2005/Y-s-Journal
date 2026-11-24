import { useQuery } from '@tanstack/react-query'
import {
  Check,
  CircleDot,
  Database,
  GitBranch,
  HardDrive,
  LockKeyhole,
  Server,
  ShieldCheck,
} from 'lucide-react'
import { HealthPill } from '@/components/health-pill'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { fetchHealth } from '@/lib/api'

function formatUptime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '—'
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}

function healthState(query) {
  if (query.isPending) return 'loading'
  if (query.isError) return 'offline'
  return query.data?.status === 'ok' ? 'healthy' : 'degraded'
}

const completedFoundationItems = [
  'Project repository initialized with a protected .gitignore',
  'React, Vite, JavaScript, Tailwind, and shadcn/ui conventions installed',
  'Express API foundation with health endpoint and Mongo connectivity check',
  'Automated test, lint, format, and production build tooling configured',
  'Architecture, security, backup, offline, and financial documentation started',
]

export function FoundationPage() {
  const healthQuery = useQuery({
    queryKey: ['system-health'],
    queryFn: fetchHealth,
    refetchInterval: 30_000,
  })

  const state = healthState(healthQuery)
  const health = healthQuery.data

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-2xl border border-border/80 bg-card/60 p-6 shadow-[0_32px_80px_-56px_rgb(0_0_0/1)] sm:p-8">
        <div
          className="pointer-events-none absolute -right-24 -top-32 size-80 rounded-full bg-primary/15 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative max-w-3xl">
          <div className="flex flex-wrap items-center gap-3">
            <Badge>Phase 0 · Foundation</Badge>
            <HealthPill state={state} />
          </div>
          <h1 className="mt-5 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            A private workspace for trades, learning, and reflection.
          </h1>
          <p className="mt-3 max-w-2xl text-pretty text-sm leading-6 text-muted-foreground sm:text-base">
            The foundation is running. No trades, learning records, or personal journal entries
            exist yet, and no sample data has been created.
          </p>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">API</CardTitle>
              <Server className="size-4 text-muted-foreground" aria-hidden="true" />
            </div>
            <CardDescription>Local Express service</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-2xl font-medium tracking-tight">
              {healthQuery.isPending ? '...' : healthQuery.isError ? 'Offline' : 'Online'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {health?.version ? `Version ${health.version}` : 'Waiting for response'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Database</CardTitle>
              <Database className="size-4 text-muted-foreground" aria-hidden="true" />
            </div>
            <CardDescription>MongoDB localhost</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-2xl font-medium tracking-tight">
              {healthQuery.isPending ? '...' : health?.mongo === 'up' ? 'Connected' : 'Down'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {health?.environment ? `${health.environment} environment` : 'No database writes'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Uptime</CardTitle>
              <CircleDot className="size-4 text-muted-foreground" aria-hidden="true" />
            </div>
            <CardDescription>Current API process</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-2xl font-medium tracking-tight">
              {health?.uptimeSeconds != null ? formatUptime(health.uptimeSeconds) : '—'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Health checked every 30 seconds</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Check className="size-4 text-success" aria-hidden="true" />
              <CardTitle>Foundation scope</CardTitle>
            </div>
            <CardDescription>
              Only infrastructure and documentation exist in this phase.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {completedFoundationItems.map((item) => (
                <li key={item} className="flex gap-3 text-sm leading-6 text-muted-foreground">
                  <Check className="mt-1 size-3.5 shrink-0 text-success" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
                <CardTitle>Privacy baseline</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="flex gap-3">
                <LockKeyhole className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                <p>
                  MongoDB is bound to localhost. No public network exposure has been configured.
                </p>
              </div>
              <div className="flex gap-3">
                <HardDrive className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                <p>Secrets, uploads, backups, and certificates are excluded from Git.</p>
              </div>
              <div className="flex gap-3">
                <GitBranch className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                <p>The private GitHub repository is pending GitHub CLI authentication.</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Next gate</CardTitle>
              <CardDescription>Phase 1 after approval</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-muted-foreground">
                Owner onboarding, authentication, sessions, auto-lock, security logs, and
                application settings.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
