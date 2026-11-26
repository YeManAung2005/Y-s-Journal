import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { fetchReferenceData } from '@/features/reference/reference-api'
import { AccountAdjustments } from './account-adjustments'
import {
  fetchAnalyticsBreakdowns,
  fetchAnalyticsComparison,
  fetchAnalyticsEquity,
  fetchAnalyticsSummary,
} from './analytics-api'
import { formatInteger, formatMoney, formatMultiple, formatPercent } from './analytics-format'
import { EquityChart } from './equity-chart'

const INITIAL_FILTERS = {
  basis: 'net',
  from: '',
  to: '',
  accountId: '',
  instrumentId: '',
  sessionId: '',
  tagId: '',
  direction: '',
  outcome: '',
  dimension: 'instrument',
  compareFrom: '',
  compareTo: '',
}

function Metric({ label, value, tone = 'default' }) {
  return (
    <div className="rounded-lg border border-border/70 bg-background/40 p-4">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={`mt-1 font-mono text-lg font-semibold ${
          tone === 'success' ? 'text-success' : tone === 'danger' ? 'text-danger' : ''
        }`}
      >
        {value}
      </p>
    </div>
  )
}

function toneForMicros(micros) {
  if (micros === null || micros === undefined) return 'default'
  if (micros > 0) return 'success'
  if (micros < 0) return 'danger'
  return 'default'
}

export function AnalyticsPage() {
  const [filters, setFilters] = useState(INITIAL_FILTERS)

  const setFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }))

  const referenceQuery = useQuery({
    queryKey: ['reference-data', false],
    queryFn: () => fetchReferenceData(false),
  })

  const baseParams = {
    basis: filters.basis,
    from: filters.from,
    to: filters.to,
    accountId: filters.accountId,
    instrumentId: filters.instrumentId,
    sessionId: filters.sessionId,
    tagId: filters.tagId,
    direction: filters.direction,
    outcome: filters.outcome,
  }

  const comparisonEnabled = Boolean(
    filters.from && filters.to && filters.compareFrom && filters.compareTo,
  )
  const comparisonParams = {
    ...baseParams,
    compareFrom: filters.compareFrom,
    compareTo: filters.compareTo,
  }

  const summaryQuery = useQuery({
    queryKey: ['analytics', 'summary', baseParams],
    queryFn: () => fetchAnalyticsSummary(baseParams),
  })
  const equityQuery = useQuery({
    queryKey: ['analytics', 'equity', baseParams],
    queryFn: () => fetchAnalyticsEquity(baseParams),
  })
  const breakdownQuery = useQuery({
    queryKey: ['analytics', 'breakdowns', baseParams, filters.dimension],
    queryFn: () => fetchAnalyticsBreakdowns({ ...baseParams, dimension: filters.dimension }),
  })
  const comparisonQuery = useQuery({
    queryKey: ['analytics', 'compare', comparisonParams],
    queryFn: () => fetchAnalyticsComparison(comparisonParams),
    enabled: comparisonEnabled,
  })

  if (
    referenceQuery.isPending ||
    summaryQuery.isPending ||
    equityQuery.isPending ||
    breakdownQuery.isPending
  ) {
    return <p className="text-sm text-muted-foreground">Loading trading analytics…</p>
  }

  const queries = [referenceQuery, summaryQuery, equityQuery, breakdownQuery]
  if (comparisonEnabled) queries.push(comparisonQuery)
  const failed = queries.find((query) => query.isError)
  if (failed) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>The API is unreachable</CardTitle>
          <CardDescription>{failed.error?.message}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" onClick={() => void failed.refetch()}>
            Try again
          </Button>
        </CardContent>
      </Card>
    )
  }

  const reference = referenceQuery.data
  const summary = summaryQuery.data.summary
  const equity = equityQuery.data.equity
  const breakdowns = breakdownQuery.data.breakdowns
  const comparison = comparisonQuery.data?.comparison
  const coverage = summary.coverage

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Trading analytics</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Metrics are calculated on the server from completed trades only. Missing fees and risk
          stay unavailable instead of being treated as zero.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>
            All cards below use the same filters. Partial exits stay a single trade.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5">
            <Label htmlFor="analytics-basis">Basis</Label>
            <Select
              id="analytics-basis"
              value={filters.basis}
              onChange={(event) => setFilter('basis', event.target.value)}
            >
              <option value="net">Net (after fees)</option>
              <option value="gross">Gross (before fees)</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="analytics-from">From</Label>
            <Input
              id="analytics-from"
              type="date"
              value={filters.from}
              onChange={(event) => setFilter('from', event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="analytics-to">To</Label>
            <Input
              id="analytics-to"
              type="date"
              value={filters.to}
              onChange={(event) => setFilter('to', event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="analytics-account">Account</Label>
            <Select
              id="analytics-account"
              value={filters.accountId}
              onChange={(event) => setFilter('accountId', event.target.value)}
            >
              <option value="">All accounts</option>
              {reference.accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="analytics-instrument">Instrument</Label>
            <Select
              id="analytics-instrument"
              value={filters.instrumentId}
              onChange={(event) => setFilter('instrumentId', event.target.value)}
            >
              <option value="">All instruments</option>
              {reference.instruments.map((instrument) => (
                <option key={instrument.id} value={instrument.id}>
                  {instrument.symbol}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="analytics-session">Trading session</Label>
            <Select
              id="analytics-session"
              value={filters.sessionId}
              onChange={(event) => setFilter('sessionId', event.target.value)}
            >
              <option value="">All sessions</option>
              {reference.tradingSessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="analytics-tag">Tag</Label>
            <Select
              id="analytics-tag"
              value={filters.tagId}
              onChange={(event) => setFilter('tagId', event.target.value)}
            >
              <option value="">All tags</option>
              {reference.tags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="analytics-direction">Direction</Label>
            <Select
              id="analytics-direction"
              value={filters.direction}
              onChange={(event) => setFilter('direction', event.target.value)}
            >
              <option value="">Both</option>
              <option value="long">Long</option>
              <option value="short">Short</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="analytics-outcome">Outcome</Label>
            <Select
              id="analytics-outcome"
              value={filters.outcome}
              onChange={(event) => setFilter('outcome', event.target.value)}
            >
              <option value="">All outcomes</option>
              <option value="win">Win</option>
              <option value="loss">Loss</option>
              <option value="break_even">Break-even</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="analytics-dimension">Breakdown by</Label>
            <Select
              id="analytics-dimension"
              value={filters.dimension}
              onChange={(event) => setFilter('dimension', event.target.value)}
            >
              <option value="instrument">Instrument</option>
              <option value="session">Trading session</option>
              <option value="direction">Direction</option>
              <option value="tag">Tag</option>
              <option value="account">Account</option>
              <option value="dayOfWeek">Day of week</option>
            </Select>
          </div>
        </CardContent>
      </Card>

      {(coverage.missingNetCount > 0 || coverage.missingRiskCount > 0) && (
        <div className="rounded-lg border border-warning/30 bg-warning-muted/40 p-4 text-sm">
          <p className="font-semibold">Partial coverage</p>
          <p className="mt-1 text-muted-foreground">
            {coverage.missingNetCount > 0
              ? `${coverage.missingNetCount} trade${coverage.missingNetCount === 1 ? '' : 's'} missing fees make net aggregates unavailable. `
              : ''}
            {coverage.missingRiskCount > 0
              ? `${coverage.missingRiskCount} trade${coverage.missingRiskCount === 1 ? '' : 's'} missing risk are excluded from average R.`
              : ''}
          </p>
        </div>
      )}

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Performance summary</h2>
          <p className="text-xs text-muted-foreground">
            Basis: {summary.basis} · {summary.tradeCount} completed trade
            {summary.tradeCount === 1 ? '' : 's'}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            label="Selected P&L"
            value={formatMoney(summary.totalPnlMicros)}
            tone={toneForMicros(summary.totalPnlMicros)}
          />
          <Metric label="Win rate" value={formatPercent(summary.winRate)} />
          <Metric label="Profit factor" value={formatMultiple(summary.profitFactor)} />
          <Metric
            label="Average R"
            value={
              summary.averageR === null
                ? '—'
                : `${Number(summary.averageR).toFixed(2)}R (${coverage.rAvailable}/${coverage.grossAvailable})`
            }
          />
          <Metric
            label="Average win"
            value={formatMoney(summary.averageWinMicros)}
            tone="success"
          />
          <Metric
            label="Average loss"
            value={formatMoney(summary.averageLossMicros)}
            tone="danger"
          />
          <Metric
            label="Max drawdown"
            value={formatMoney(summary.maxDrawdownMicros)}
            tone="danger"
          />
          <Metric
            label="Wins / losses / breakeven"
            value={`${formatInteger(summary.wins)} / ${formatInteger(summary.losses)} / ${formatInteger(summary.breakEvens)}`}
          />
          <Metric
            label="Winning / losing days"
            value={`${formatInteger(summary.winningDays)} / ${formatInteger(summary.losingDays)}`}
          />
          <Metric
            label="Current streak"
            value={
              summary.streaks
                ? `${summary.streaks.currentWinningStreak}W / ${summary.streaks.currentLosingStreak}L`
                : '—'
            }
          />
          <Metric
            label="Longest streak"
            value={
              summary.streaks
                ? `${summary.streaks.longestWinningStreak}W / ${summary.streaks.longestLosingStreak}L`
                : '—'
            }
          />
          <Metric
            label="Gross P&L"
            value={formatMoney(summary.grossPnlMicros)}
            tone={toneForMicros(summary.grossPnlMicros)}
          />
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Equity and drawdown</CardTitle>
          <CardDescription>
            {filters.accountId
              ? `Account balance starts at ${formatMoney(equity.startingBalanceMicros)} and includes adjustments.`
              : 'Select one account to include starting balance and adjustments in the balance line.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <EquityChart points={equity.points} />
          {filters.accountId ? (
            <div className="flex flex-wrap gap-4 text-sm">
              <span className="text-muted-foreground">
                Latest account balance:{' '}
                <span className="font-mono font-semibold text-foreground">
                  {formatMoney(equity.accountBalanceMicros)}
                </span>
              </span>
              <span className="text-muted-foreground">
                Net curve:{' '}
                <span className="font-mono font-semibold text-foreground">
                  {formatMoney(equity.cumulativeNetPnlMicros)}
                </span>
              </span>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Breakdowns</CardTitle>
          <CardDescription>
            Net groups stay unavailable when any trade in that group is missing fees. Tag breakdowns
            count a trade once per applied tag.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {breakdowns.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">
              No trades match these filters.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border/70 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-4">Group</th>
                    <th className="py-2 pr-4">Trades</th>
                    <th className="py-2 pr-4">P&L</th>
                    <th className="py-2 pr-4">Win rate</th>
                    <th className="py-2 pr-4">Avg R</th>
                    <th className="py-2">Profit factor</th>
                  </tr>
                </thead>
                <tbody>
                  {breakdowns.map((item) => (
                    <tr key={item.label} className="border-b border-border/40 last:border-0">
                      <td className="py-2.5 pr-4 font-medium">{item.label}</td>
                      <td className="py-2.5 pr-4 font-mono">{item.summary.tradeCount}</td>
                      <td className="py-2.5 pr-4 font-mono">
                        {formatMoney(item.summary.totalPnlMicros)}
                      </td>
                      <td className="py-2.5 pr-4 font-mono">
                        {formatPercent(item.summary.winRate)}
                      </td>
                      <td className="py-2.5 pr-4 font-mono">
                        {item.summary.averageR === null
                          ? '—'
                          : `${Number(item.summary.averageR).toFixed(2)}R`}
                      </td>
                      <td className="py-2.5 font-mono">
                        {formatMultiple(item.summary.profitFactor)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Period comparison</CardTitle>
          <CardDescription>
            Set both ranges to compare the selected filters across two periods.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="analytics-compare-from">Comparison from</Label>
              <Input
                id="analytics-compare-from"
                type="date"
                value={filters.compareFrom}
                onChange={(event) => setFilter('compareFrom', event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="analytics-compare-to">Comparison to</Label>
              <Input
                id="analytics-compare-to"
                type="date"
                value={filters.compareTo}
                onChange={(event) => setFilter('compareTo', event.target.value)}
              />
            </div>
          </div>

          {comparison ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric
                label="Current P&L"
                value={formatMoney(comparison.current.totalPnlMicros)}
                tone={toneForMicros(comparison.current.totalPnlMicros)}
              />
              <Metric
                label="Baseline P&L"
                value={formatMoney(comparison.baseline.totalPnlMicros)}
              />
              <Metric
                label="P&L change"
                value={formatMoney(comparison.deltas.totalPnlMicros)}
                tone={toneForMicros(comparison.deltas.totalPnlMicros)}
              />
              <Metric label="Win-rate change" value={formatPercent(comparison.deltas.winRate)} />
              <div className="sm:col-span-2 lg:col-span-4">
                <Badge variant="secondary">
                  {comparison.current.tradeCount} current vs {comparison.baseline.tradeCount}{' '}
                  baseline trades
                </Badge>
              </div>
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-border/70 p-4 text-center text-sm text-muted-foreground">
              Add the main and comparison date ranges to see deltas.
            </p>
          )}
        </CardContent>
      </Card>

      <AccountAdjustments accounts={reference.accounts} />
    </div>
  )
}
