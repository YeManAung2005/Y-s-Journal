import { formatMoney } from './analytics-format'

const WIDTH = 640
const HEIGHT = 180
const PADDING = 18

export function EquityChart({ points }) {
  const available = points.filter((point) => point.cumulativeNetPnlMicros !== null)
  if (available.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">
        No net equity points are available yet. Enter fees on your trades to unlock this curve.
      </p>
    )
  }

  const values = available.map((point) => point.cumulativeNetPnlMicros)
  const min = Math.min(...values, 0)
  const max = Math.max(...values, 0)
  const range = max - min || 1
  const xFor = (index) => PADDING + (index / Math.max(points.length - 1, 1)) * (WIDTH - PADDING * 2)
  const yFor = (value) => HEIGHT - PADDING - ((value - min) / range) * (HEIGHT - PADDING * 2)

  const segments = []
  let current = []
  points.forEach((point, index) => {
    if (point.cumulativeNetPnlMicros === null) {
      if (current.length > 0) segments.push(current)
      current = []
      return
    }
    current.push(`${xFor(index)},${yFor(point.cumulativeNetPnlMicros)}`)
  })
  if (current.length > 0) segments.push(current)

  const zeroY = yFor(0)
  const lastValue = values.at(-1)

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>Cumulative net P&amp;L from $0 for the selected filters</span>
        <span className="font-mono text-foreground">{formatMoney(lastValue)}</span>
      </div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-48 w-full rounded-lg border border-border/60 bg-background/40"
        role="img"
        aria-label="Cumulative net P&L equity curve"
        preserveAspectRatio="none"
      >
        <line
          x1={PADDING}
          x2={WIDTH - PADDING}
          y1={zeroY}
          y2={zeroY}
          stroke="currentColor"
          strokeOpacity="0.25"
          strokeDasharray="4 4"
        />
        {segments.map((segment, index) => (
          <polyline
            key={index}
            points={segment.join(' ')}
            fill="none"
            stroke="var(--color-primary, #7c3aed)"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
        {points.map((point, index) =>
          point.kind === 'trade' && point.cumulativeNetPnlMicros !== null ? (
            <circle
              key={point.id}
              cx={xFor(index)}
              cy={yFor(point.cumulativeNetPnlMicros)}
              r="2.75"
              fill="var(--color-primary, #7c3aed)"
            >
              <title>
                {`${point.date} ${point.symbol ?? ''} ${point.direction ?? ''}: ${formatMoney(point.tradePnlMicros)}`}
              </title>
            </circle>
          ) : null,
        )}
      </svg>
      <p className="text-[11px] text-muted-foreground">
        Gaps mean at least one selected trade has no recorded fees; unavailable values are never
        treated as zero.
      </p>
    </div>
  )
}
