import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowUpRight, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { fetchReferenceData } from '@/features/reference/reference-api'
import { fetchTrades } from './trades-api'
import { TradeForm } from './trade-form'

function money(micros) {
  if (micros === null || micros === undefined) return 'Unavailable'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(micros / 1_000_000)
}

function outcomeVariant(outcome) {
  if (outcome === 'win') return 'success'
  if (outcome === 'loss') return 'danger'
  return 'secondary'
}

export function TradesPage() {
  const navigate = useNavigate()
  const [showForm, setShowForm] = useState(false)

  const referenceQuery = useQuery({
    queryKey: ['reference-data', false],
    queryFn: () => fetchReferenceData(false),
  })
  const tradesQuery = useQuery({
    queryKey: ['trades'],
    queryFn: () => fetchTrades({}),
  })

  if (referenceQuery.isPending || tradesQuery.isPending) {
    return <p className="text-sm text-muted-foreground">Loading trading journal…</p>
  }

  if (referenceQuery.isError || tradesQuery.isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>The API is unreachable</CardTitle>
          <CardDescription>
            {referenceQuery.error?.message || tradesQuery.error?.message}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            onClick={() => {
              void referenceQuery.refetch()
              void tradesQuery.refetch()
            }}
          >
            Try again
          </Button>
        </CardContent>
      </Card>
    )
  }

  const trades = tradesQuery.data.trades

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Trading journal</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Completed trades only. Net P&amp;L and R stay unavailable until actual fees and risk are
            entered.
          </p>
        </div>
        <Button type="button" onClick={() => setShowForm((value) => !value)}>
          <Plus aria-hidden="true" />
          {showForm ? 'Hide form' : 'New trade'}
        </Button>
      </header>

      {showForm ? (
        <TradeForm
          reference={referenceQuery.data}
          onCancel={() => setShowForm(false)}
          onSaved={(trade) =>
            void navigate({ to: '/trades/$tradeId', params: { tradeId: trade.id } })
          }
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Completed trades</CardTitle>
          <CardDescription>
            {trades.length === 0
              ? 'No trades recorded yet. No sample data is created.'
              : `${trades.length} trade${trades.length === 1 ? '' : 's'} recorded.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {trades.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">
              Record your first completed trade when you are ready.
            </p>
          ) : (
            <div className="space-y-2">
              {trades.map((trade) => (
                <Link
                  key={trade.id}
                  to="/trades/$tradeId"
                  params={{ tradeId: trade.id }}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-background/40 p-3 transition-colors hover:bg-accent/50"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold">
                        {trade.instrumentSnapshot.symbol}
                      </span>
                      <Badge variant={trade.direction === 'long' ? 'success' : 'danger'}>
                        {trade.direction}
                      </Badge>
                      <Badge variant={outcomeVariant(trade.outcomeNet ?? trade.outcomeGross)}>
                        {(trade.outcomeNet ?? trade.outcomeGross).replace('_', ' ')}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {trade.tradeDate} · {trade.accountSnapshot.name} · {trade.quantity} contracts
                      · {trade.screenshots.length} screenshot
                      {trade.screenshots.length === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        Net P&amp;L
                      </p>
                      <p className="font-mono text-sm font-semibold">{money(trade.netPnlMicros)}</p>
                    </div>
                    <ArrowUpRight className="size-4 text-muted-foreground" aria-hidden="true" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
