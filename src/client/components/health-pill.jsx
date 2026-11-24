import { Badge } from '@/components/ui/badge'

const states = {
  loading: { label: 'Checking', variant: 'outline' },
  healthy: { label: 'Operational', variant: 'success' },
  degraded: { label: 'Degraded', variant: 'danger' },
  offline: { label: 'API unreachable', variant: 'danger' },
}

export function HealthPill({ state }) {
  const current = states[state] ?? states.loading
  return (
    <Badge variant={current.variant}>
      <span
        className={`size-1.5 rounded-full ${
          current.variant === 'success'
            ? 'bg-success'
            : current.variant === 'danger'
              ? 'bg-danger'
              : 'bg-muted-foreground'
        }`}
        aria-hidden="true"
      />
      {current.label}
    </Badge>
  )
}
