import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { OptionalFields } from '@/components/ui/optional-fields'
import { Select } from '@/components/ui/select'
import {
  createAccountAdjustment,
  deleteAccountAdjustment,
  fetchAccountAdjustments,
} from './analytics-api'
import { formatMoney } from './analytics-format'

const TODAY = new Date().toISOString().slice(0, 10)

export function AccountAdjustments({ accounts }) {
  const queryClient = useQueryClient()
  const activeAccounts = accounts.filter((account) => !account.archivedAt)
  const [accountId, setAccountId] = useState(activeAccounts[0]?.id ?? '')
  const [showForm, setShowForm] = useState(false)
  const [type, setType] = useState('deposit')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(TODAY)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  const adjustmentsQuery = useQuery({
    queryKey: ['account-adjustments', accountId],
    queryFn: () => fetchAccountAdjustments(accountId),
    enabled: Boolean(accountId),
  })

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['account-adjustments'] })
    void queryClient.invalidateQueries({ queryKey: ['analytics'] })
  }

  const createMutation = useMutation({
    mutationFn: () => createAccountAdjustment(accountId, { type, amount, date, note }),
    onSuccess: () => {
      setAmount('')
      setNote('')
      setError('')
      setShowForm(false)
      invalidate()
    },
    onError: (mutationError) => setError(mutationError.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (adjustment) =>
      deleteAccountAdjustment(adjustment.id, adjustment.expectedVersion ?? adjustment.version),
    onSuccess: invalidate,
    onError: (mutationError) => setError(mutationError.message),
  })

  const adjustments = adjustmentsQuery.data?.adjustments ?? []

  function submit(event) {
    event.preventDefault()
    createMutation.mutate()
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5">
          <CardTitle>Account adjustments</CardTitle>
          <CardDescription>
            Deposits, withdrawals, and signed corrections are included in account balance, never in
            trading P&amp;L.
          </CardDescription>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowForm((value) => !value)}
          disabled={!accountId}
          aria-expanded={showForm}
        >
          <Plus aria-hidden="true" />
          {showForm ? 'Hide form' : 'Add adjustment'}
        </Button>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-1.5 sm:max-w-xs">
          <Label htmlFor="adjustment-view-account">View account</Label>
          <Select
            id="adjustment-view-account"
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
          >
            {activeAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </Select>
        </div>

        {showForm ? (
          <form className="space-y-4" onSubmit={submit}>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="adjustment-type">Type</Label>
                <Select
                  id="adjustment-type"
                  value={type}
                  onChange={(event) => setType(event.target.value)}
                >
                  <option value="deposit">Deposit</option>
                  <option value="withdrawal">Withdrawal</option>
                  <option value="correction">Correction</option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="adjustment-amount">
                  Amount {type === 'correction' ? '(signed)' : ''}
                </Label>
                <Input
                  id="adjustment-amount"
                  inputMode="decimal"
                  placeholder={type === 'correction' ? '-50.00' : '500.00'}
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="adjustment-date">Date</Label>
                <Input
                  id="adjustment-date"
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
              </div>
            </div>

            <OptionalFields>
              <div className="space-y-1.5">
                <Label htmlFor="adjustment-note">Note</Label>
                <Input
                  id="adjustment-note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="e.g. Transfer from savings"
                />
              </div>
            </OptionalFields>

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={!accountId || createMutation.isPending}>
                Add adjustment
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : null}

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        {adjustments.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border/70 p-4 text-center text-sm text-muted-foreground">
            No adjustments recorded for this account.
          </p>
        ) : (
          <div className="space-y-2">
            {adjustments.map((adjustment) => (
              <div
                key={adjustment.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-background/40 p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={adjustment.signedAmountMicros >= 0 ? 'success' : 'danger'}>
                    {adjustment.type}
                  </Badge>
                  <span className="font-mono text-sm font-semibold">
                    {formatMoney(adjustment.signedAmountMicros)}
                  </span>
                  <span className="text-xs text-muted-foreground">{adjustment.date}</span>
                  {adjustment.note ? (
                    <span className="text-xs text-muted-foreground">· {adjustment.note}</span>
                  ) : null}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${adjustment.type} adjustment`}
                  disabled={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate(adjustment)}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
