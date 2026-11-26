import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Archive, Calculator, Check, Plus, RotateCcw, Star } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { OptionalFields } from '@/components/ui/optional-fields'
import { Select } from '@/components/ui/select'
import {
  calculateTrade,
  createReferenceRecord,
  fetchReferenceData,
  referenceAction,
  updateReferenceRecord,
} from './reference-api'

const EMPTY_ACCOUNT = { name: '', broker: '', accountType: 'live', startingBalance: '0' }
const EMPTY_TAG = { type: 'setup', name: '', color: '#64748b' }
const EMPTY_SESSION = { name: '', color: '#64748b', displayOrder: '0' }
const EMPTY_CHECKLIST = { text: '', sortOrder: '0' }
const EMPTY_INSTRUMENT = {
  symbol: '',
  name: '',
  tickSize: '0.25',
  tickValue: '5.00',
  pointValue: '20.00',
}

function toMicros(value) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return 0
  return Math.round(amount * 1_000_000)
}

function formatMoney(micros) {
  if (micros === null || micros === undefined) return 'Unavailable'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(micros / 1_000_000)
}

function ErrorText({ error }) {
  if (!error) return null
  return (
    <p className="text-sm text-danger" role="alert">
      {error.message}
    </p>
  )
}

function Field({ label, children }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function Section({ title, description, action, children }) {
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function RecordRow({ title, meta, badges, children }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border/70 bg-background/40 p-3">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium">{title}</p>
          {badges}
        </div>
        {meta ? <p className="text-xs text-muted-foreground">{meta}</p> : null}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  )
}

function useReferenceMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ kind, id, action, payload }) => {
      if (action) return referenceAction(kind, id, action)
      if (id) return updateReferenceRecord(kind, id, payload)
      return createReferenceRecord(kind, payload)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reference-data'] }),
  })
}

function AccountsSection({ accounts, mutation }) {
  const [form, setForm] = useState(EMPTY_ACCOUNT)
  const [showForm, setShowForm] = useState(false)

  function submit(event) {
    event.preventDefault()
    mutation.mutate(
      { kind: 'accounts', payload: form },
      {
        onSuccess: () => {
          setForm(EMPTY_ACCOUNT)
          setShowForm(false)
        },
      },
    )
  }

  return (
    <Section
      title="Trading accounts"
      description="One editable default account with a $0.00 starting balance is created automatically. Deposits and withdrawals arrive with a later phase."
      action={
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowForm((value) => !value)}
          aria-expanded={showForm}
        >
          <Plus aria-hidden="true" />
          {showForm ? 'Hide form' : 'Add account'}
        </Button>
      }
    >
      {showForm ? (
        <form className="space-y-3" onSubmit={submit}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Name">
              <Input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="Main Account"
                required
              />
            </Field>
            <Field label="Type">
              <Select
                value={form.accountType}
                onChange={(event) => setForm({ ...form, accountType: event.target.value })}
              >
                <option value="live">Live</option>
                <option value="demo">Demo</option>
              </Select>
            </Field>
            <Field label="Starting balance">
              <Input
                inputMode="decimal"
                value={form.startingBalance}
                onChange={(event) => setForm({ ...form, startingBalance: event.target.value })}
              />
            </Field>
            <div className="flex items-end">
              <Button type="submit" disabled={mutation.isPending}>
                <Plus aria-hidden="true" /> Add account
              </Button>
            </div>
          </div>
          <OptionalFields>
            <Field label="Broker">
              <Input
                value={form.broker}
                onChange={(event) => setForm({ ...form, broker: event.target.value })}
                placeholder="Optional"
              />
            </Field>
          </OptionalFields>
        </form>
      ) : null}

      <ErrorText error={mutation.error} />

      <div className="mt-4 space-y-2">
        {accounts.map((account) => (
          <RecordRow
            key={account.id}
            title={account.name}
            meta={`${account.accountType} · ${account.broker || 'No broker'} · Started ${formatMoney(
              account.startingBalanceMicros,
            )}`}
            badges={
              account.isDefault ? (
                <Badge variant="success">
                  <Star aria-hidden="true" /> Default
                </Badge>
              ) : null
            }
          >
            {!account.isDefault && !account.archivedAt ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  mutation.mutate({ kind: 'accounts', id: account.id, action: 'set-default' })
                }
              >
                Set default
              </Button>
            ) : null}
            {account.archivedAt ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  mutation.mutate({ kind: 'accounts', id: account.id, action: 'restore' })
                }
              >
                <RotateCcw aria-hidden="true" /> Restore
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() =>
                  mutation.mutate({ kind: 'accounts', id: account.id, action: 'archive' })
                }
                aria-label={`Archive ${account.name}`}
              >
                <Archive aria-hidden="true" />
              </Button>
            )}
          </RecordRow>
        ))}
      </div>
    </Section>
  )
}

function InstrumentsSection({ instruments, mutation }) {
  const [form, setForm] = useState(EMPTY_INSTRUMENT)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [editForm, setEditForm] = useState(null)

  function submit(event) {
    event.preventDefault()
    mutation.mutate(
      {
        kind: 'instruments',
        payload: {
          symbol: form.symbol,
          name: form.name,
          tickSizeMicros: toMicros(form.tickSize),
          tickValueMicros: toMicros(form.tickValue),
          pointValueMicros: toMicros(form.pointValue),
        },
      },
      {
        onSuccess: () => {
          setForm(EMPTY_INSTRUMENT)
          setShowForm(false)
        },
      },
    )
  }

  function saveEdit(instrument) {
    mutation.mutate(
      {
        kind: 'instruments',
        id: instrument.id,
        payload: {
          expectedVersion: instrument.version,
          name: editForm.name,
          tickSizeMicros: toMicros(editForm.tickSize),
          tickValueMicros: toMicros(editForm.tickValue),
          pointValueMicros: toMicros(editForm.pointValue),
        },
      },
      { onSuccess: () => setEditing(null) },
    )
  }

  return (
    <Section
      title="Instruments"
      description="NQ, MNQ, ES, and MES are preconfigured. Specifications can be edited; historical trades keep their own snapshots."
      action={
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowForm((value) => !value)}
          aria-expanded={showForm}
        >
          <Plus aria-hidden="true" />
          {showForm ? 'Hide form' : 'Add instrument'}
        </Button>
      }
    >
      {showForm ? (
        <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6" onSubmit={submit}>
          <Field label="Symbol">
            <Input
              value={form.symbol}
              maxLength={10}
              onChange={(event) => setForm({ ...form, symbol: event.target.value.toUpperCase() })}
              placeholder="NQ"
              required
            />
          </Field>
          <Field label="Name">
            <Input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Nasdaq 100"
              required
            />
          </Field>
          <Field label="Tick size">
            <Input
              inputMode="decimal"
              value={form.tickSize}
              onChange={(event) => setForm({ ...form, tickSize: event.target.value })}
            />
          </Field>
          <Field label="Tick value">
            <Input
              inputMode="decimal"
              value={form.tickValue}
              onChange={(event) => setForm({ ...form, tickValue: event.target.value })}
            />
          </Field>
          <Field label="Point value">
            <Input
              inputMode="decimal"
              value={form.pointValue}
              onChange={(event) => setForm({ ...form, pointValue: event.target.value })}
            />
          </Field>
          <div className="flex items-end">
            <Button type="submit" disabled={mutation.isPending}>
              <Plus aria-hidden="true" /> Add
            </Button>
          </div>
        </form>
      ) : null}

      <ErrorText error={mutation.error} />

      <div className="mt-4 space-y-2">
        {instruments.map((instrument) => (
          <div
            key={instrument.id}
            className="rounded-lg border border-border/70 bg-background/40 p-3"
          >
            {editing === instrument.id ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <Field label="Name">
                  <Input
                    value={editForm.name}
                    onChange={(event) => setEditForm({ ...editForm, name: event.target.value })}
                  />
                </Field>
                <Field label="Tick size">
                  <Input
                    value={editForm.tickSize}
                    onChange={(event) => setEditForm({ ...editForm, tickSize: event.target.value })}
                  />
                </Field>
                <Field label="Tick value">
                  <Input
                    value={editForm.tickValue}
                    onChange={(event) =>
                      setEditForm({ ...editForm, tickValue: event.target.value })
                    }
                  />
                </Field>
                <Field label="Point value">
                  <Input
                    value={editForm.pointValue}
                    onChange={(event) =>
                      setEditForm({ ...editForm, pointValue: event.target.value })
                    }
                  />
                </Field>
                <div className="flex items-end gap-2">
                  <Button type="button" size="sm" onClick={() => saveEdit(instrument)}>
                    <Check aria-hidden="true" /> Save
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-mono text-sm font-semibold">{instrument.symbol}</p>
                    {instrument.builtIn ? <Badge variant="secondary">Built in</Badge> : null}
                    {!instrument.active ? <Badge variant="outline">Archived</Badge> : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {instrument.name} · Tick {Number(instrument.tickSizeMicros) / 1_000_000} · Tick
                    value {formatMoney(instrument.tickValueMicros)} · Point value{' '}
                    {formatMoney(instrument.pointValueMicros)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditing(instrument.id)
                      setEditForm({
                        name: instrument.name,
                        tickSize: String(Number(instrument.tickSizeMicros) / 1_000_000),
                        tickValue: String(Number(instrument.tickValueMicros) / 1_000_000),
                        pointValue: String(Number(instrument.pointValueMicros) / 1_000_000),
                      })
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      mutation.mutate({
                        kind: 'instruments',
                        id: instrument.id,
                        action: instrument.active ? 'archive' : 'restore',
                      })
                    }
                    aria-label={`${instrument.active ? 'Archive' : 'Restore'} ${instrument.symbol}`}
                  >
                    {instrument.active ? (
                      <Archive aria-hidden="true" />
                    ) : (
                      <RotateCcw aria-hidden="true" />
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </Section>
  )
}

function TagsSection({ tags, mutation }) {
  const [form, setForm] = useState(EMPTY_TAG)
  const [showForm, setShowForm] = useState(false)

  function submit(event) {
    event.preventDefault()
    mutation.mutate(
      { kind: 'tags', payload: form },
      {
        onSuccess: () => {
          setForm(EMPTY_TAG)
          setShowForm(false)
        },
      },
    )
  }

  return (
    <Section
      title="Tags"
      description="Setups, market conditions, and custom labels can be attached to completed trades in Phase 3."
      action={
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowForm((value) => !value)}
          aria-expanded={showForm}
        >
          <Plus aria-hidden="true" />
          {showForm ? 'Hide form' : 'Add tag'}
        </Button>
      }
    >
      {showForm ? (
        <form className="space-y-3" onSubmit={submit}>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Type">
              <Select
                value={form.type}
                onChange={(event) => setForm({ ...form, type: event.target.value })}
              >
                <option value="setup">Setup</option>
                <option value="market_condition">Market condition</option>
                <option value="custom">Custom</option>
              </Select>
            </Field>
            <Field label="Name">
              <Input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                required
              />
            </Field>
            <div className="flex items-end">
              <Button type="submit" disabled={mutation.isPending}>
                <Plus aria-hidden="true" /> Add tag
              </Button>
            </div>
          </div>
          <OptionalFields>
            <Field label="Color">
              <Input
                type="color"
                value={form.color}
                onChange={(event) => setForm({ ...form, color: event.target.value })}
                className="h-10 w-20 p-1"
              />
            </Field>
          </OptionalFields>
        </form>
      ) : null}

      <ErrorText error={mutation.error} />

      <div className="mt-4 space-y-2">
        {tags.length === 0 ? <p className="text-sm text-muted-foreground">No tags yet.</p> : null}
        {tags.map((tag) => (
          <RecordRow
            key={tag.id}
            title={tag.name}
            meta={tag.type.replace('_', ' ')}
            badges={tag.archivedAt ? <Badge variant="outline">Archived</Badge> : null}
          >
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() =>
                mutation.mutate({
                  kind: 'tags',
                  id: tag.id,
                  action: tag.archivedAt ? 'restore' : 'archive',
                })
              }
              aria-label={`${tag.archivedAt ? 'Restore' : 'Archive'} ${tag.name}`}
            >
              {tag.archivedAt ? <RotateCcw aria-hidden="true" /> : <Archive aria-hidden="true" />}
            </Button>
          </RecordRow>
        ))}
      </div>
    </Section>
  )
}

function SessionsSection({ sessions, mutation }) {
  const [form, setForm] = useState(EMPTY_SESSION)
  const [showForm, setShowForm] = useState(false)

  function submit(event) {
    event.preventDefault()
    mutation.mutate(
      {
        kind: 'trading-sessions',
        payload: { ...form, displayOrder: Number(form.displayOrder) },
      },
      {
        onSuccess: () => {
          setForm(EMPTY_SESSION)
          setShowForm(false)
        },
      },
    )
  }

  return (
    <Section
      title="Trading sessions"
      description="Name the sessions you trade, such as Asia, London, or New York."
      action={
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowForm((value) => !value)}
          aria-expanded={showForm}
        >
          <Plus aria-hidden="true" />
          {showForm ? 'Hide form' : 'Add session'}
        </Button>
      }
    >
      {showForm ? (
        <form className="space-y-3" onSubmit={submit}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name">
              <Input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                required
              />
            </Field>
            <div className="flex items-end">
              <Button type="submit" disabled={mutation.isPending}>
                <Plus aria-hidden="true" /> Add session
              </Button>
            </div>
          </div>
          <OptionalFields>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Color">
                <Input
                  type="color"
                  value={form.color}
                  onChange={(event) => setForm({ ...form, color: event.target.value })}
                  className="h-10 w-20 p-1"
                />
              </Field>
              <Field label="Display order">
                <Input
                  type="number"
                  min="0"
                  max="999"
                  value={form.displayOrder}
                  onChange={(event) => setForm({ ...form, displayOrder: event.target.value })}
                />
              </Field>
            </div>
          </OptionalFields>
        </form>
      ) : null}

      <ErrorText error={mutation.error} />

      <div className="mt-4 space-y-2">
        {sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No trading sessions yet.</p>
        ) : null}
        {sessions.map((session) => (
          <RecordRow
            key={session.id}
            title={session.name}
            meta={`Order ${session.displayOrder}`}
            badges={session.archivedAt ? <Badge variant="outline">Archived</Badge> : null}
          >
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() =>
                mutation.mutate({
                  kind: 'trading-sessions',
                  id: session.id,
                  action: session.archivedAt ? 'restore' : 'archive',
                })
              }
              aria-label={`${session.archivedAt ? 'Restore' : 'Archive'} ${session.name}`}
            >
              {session.archivedAt ? (
                <RotateCcw aria-hidden="true" />
              ) : (
                <Archive aria-hidden="true" />
              )}
            </Button>
          </RecordRow>
        ))}
      </div>
    </Section>
  )
}

function ChecklistSection({ checklist, mutation }) {
  const [form, setForm] = useState(EMPTY_CHECKLIST)
  const [showForm, setShowForm] = useState(false)

  function submit(event) {
    event.preventDefault()
    mutation.mutate(
      { kind: 'checklist', payload: { ...form, sortOrder: Number(form.sortOrder) } },
      {
        onSuccess: () => {
          setForm(EMPTY_CHECKLIST)
          setShowForm(false)
        },
      },
    )
  }

  return (
    <Section
      title="Pre-trade checklist"
      description="Add your own rules and reminders. They will be available when completed trades arrive in Phase 3."
      action={
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowForm((value) => !value)}
          aria-expanded={showForm}
        >
          <Plus aria-hidden="true" />
          {showForm ? 'Hide form' : 'Add item'}
        </Button>
      }
    >
      {showForm ? (
        <form className="space-y-3" onSubmit={submit}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Checklist item">
              <Input
                value={form.text}
                onChange={(event) => setForm({ ...form, text: event.target.value })}
                placeholder="Did I confirm my risk?"
                required
              />
            </Field>
            <div className="flex items-end">
              <Button type="submit" disabled={mutation.isPending}>
                <Plus aria-hidden="true" /> Add item
              </Button>
            </div>
          </div>
          <OptionalFields>
            <Field label="Order">
              <Input
                type="number"
                min="0"
                max="9999"
                value={form.sortOrder}
                onChange={(event) => setForm({ ...form, sortOrder: event.target.value })}
              />
            </Field>
          </OptionalFields>
        </form>
      ) : null}

      <ErrorText error={mutation.error} />

      <div className="mt-4 space-y-2">
        {checklist.length === 0 ? (
          <p className="text-sm text-muted-foreground">No checklist items yet.</p>
        ) : null}
        {checklist.map((item) => (
          <RecordRow
            key={item.id}
            title={item.text}
            meta={`Order ${item.sortOrder}`}
            badges={item.archivedAt ? <Badge variant="outline">Archived</Badge> : null}
          >
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() =>
                mutation.mutate({
                  kind: 'checklist',
                  id: item.id,
                  action: item.archivedAt ? 'restore' : 'archive',
                })
              }
              aria-label={`${item.archivedAt ? 'Restore' : 'Archive'} ${item.text}`}
            >
              {item.archivedAt ? <RotateCcw aria-hidden="true" /> : <Archive aria-hidden="true" />}
            </Button>
          </RecordRow>
        ))}
      </div>
    </Section>
  )
}

function CalculatorSection({ instruments }) {
  const activeInstruments = instruments.filter((instrument) => instrument.active)
  const [showForm, setShowForm] = useState(false)
  const [instrumentId, setInstrumentId] = useState('')
  const [direction, setDirection] = useState('long')
  const [entryPrice, setEntryPrice] = useState('')
  const [quantity, setQuantity] = useState('')
  const [exits, setExits] = useState([{ price: '', quantity: '' }])
  const [fees, setFees] = useState('')
  const [stop, setStop] = useState('')
  const [manualRisk, setManualRisk] = useState('')
  const [result, setResult] = useState(null)
  const selectedInstrumentId = instrumentId || activeInstruments[0]?.id || ''

  const mutation = useMutation({
    mutationFn: calculateTrade,
    onSuccess: (data) => setResult(data.calculation),
  })

  function updateExit(index, field, value) {
    setExits((current) =>
      current.map((exit, exitIndex) => (exitIndex === index ? { ...exit, [field]: value } : exit)),
    )
  }

  function submit(event) {
    event.preventDefault()
    const instrument = activeInstruments.find((item) => item.id === selectedInstrumentId)
    if (!instrument) return

    mutation.mutate({
      direction,
      instrument: {
        pointValueMicros: instrument.pointValueMicros,
        tickValueMicros: instrument.tickValueMicros,
        tickSizeMicros: instrument.tickSizeMicros,
      },
      entryPrice,
      quantity,
      exits,
      fees: fees === '' ? null : fees,
      initialStopPrice: stop === '' ? null : stop,
      manualRisk: manualRisk === '' ? null : manualRisk,
    })
  }

  return (
    <Section
      title="Financial calculator"
      description="Server-authoritative preview using the approved formulas. Nothing is saved."
      action={
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowForm((value) => !value)}
          aria-expanded={showForm}
        >
          <Calculator aria-hidden="true" />
          {showForm ? 'Hide calculator' : 'Open calculator'}
        </Button>
      }
    >
      {showForm ? (
        <form className="space-y-4" onSubmit={submit}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Instrument">
              <Select
                value={selectedInstrumentId}
                onChange={(event) => setInstrumentId(event.target.value)}
              >
                {activeInstruments.map((instrument) => (
                  <option key={instrument.id} value={instrument.id}>
                    {instrument.symbol}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Direction">
              <Select value={direction} onChange={(event) => setDirection(event.target.value)}>
                <option value="long">Long</option>
                <option value="short">Short</option>
              </Select>
            </Field>
            <Field label="Entry price">
              <Input
                inputMode="decimal"
                value={entryPrice}
                onChange={(event) => setEntryPrice(event.target.value)}
                placeholder="25000.00"
                required
              />
            </Field>
            <Field label="Quantity">
              <Input
                inputMode="decimal"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                placeholder="3.00"
                required
              />
            </Field>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Partial exits</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setExits([...exits, { price: '', quantity: '' }])}
              >
                <Plus aria-hidden="true" /> Add exit
              </Button>
            </div>
            {exits.map((exit, index) => (
              <div key={index} className="grid gap-2 sm:grid-cols-3">
                <Input
                  aria-label={`Exit ${index + 1} price`}
                  inputMode="decimal"
                  placeholder="Exit price"
                  value={exit.price}
                  onChange={(event) => updateExit(index, 'price', event.target.value)}
                  required
                />
                <Input
                  aria-label={`Exit ${index + 1} quantity`}
                  inputMode="decimal"
                  placeholder="Exit quantity"
                  value={exit.quantity}
                  onChange={(event) => updateExit(index, 'quantity', event.target.value)}
                  required
                />
                {exits.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setExits(exits.filter((_, exitIndex) => exitIndex !== index))}
                  >
                    Remove
                  </Button>
                ) : null}
              </div>
            ))}
          </div>

          <OptionalFields>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Total fees">
                <Input
                  inputMode="decimal"
                  value={fees}
                  onChange={(event) => setFees(event.target.value)}
                  placeholder="Leave empty if not entered"
                />
              </Field>
              <Field label="Initial stop">
                <Input
                  inputMode="decimal"
                  value={stop}
                  onChange={(event) => setStop(event.target.value)}
                  placeholder="Optional"
                />
              </Field>
              <Field label="Manual risk">
                <Input
                  inputMode="decimal"
                  value={manualRisk}
                  onChange={(event) => setManualRisk(event.target.value)}
                  placeholder="Optional override"
                />
              </Field>
            </div>
          </OptionalFields>

          <Button type="submit" disabled={mutation.isPending || activeInstruments.length === 0}>
            <Calculator aria-hidden="true" /> Calculate
          </Button>
        </form>
      ) : null}

      <ErrorText error={mutation.error} />

      {result ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-border/70 bg-background/40 p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Gross P&L</p>
            <p className="text-lg font-semibold">{formatMoney(result.grossPnlMicros)}</p>
            <p className="text-xs text-muted-foreground">{result.outcomeGross}</p>
          </div>
          <div className="rounded-lg border border-border/70 bg-background/40 p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Net P&L</p>
            <p className="text-lg font-semibold">{formatMoney(result.netPnlMicros)}</p>
            <p className="text-xs text-muted-foreground">{result.outcomeNet ?? 'Unavailable'}</p>
          </div>
          <div className="rounded-lg border border-border/70 bg-background/40 p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Gross R</p>
            <p className="text-lg font-semibold">
              {result.grossR === null ? 'Unavailable' : Number(result.grossR).toFixed(4)}
            </p>
            <p className="text-xs text-muted-foreground">
              Risk {formatMoney(result.selectedRiskMicros)}
            </p>
          </div>
          <div className="rounded-lg border border-border/70 bg-background/40 p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Avg exit price
            </p>
            <p className="text-lg font-semibold">
              {Number(result.weightedAverageExitPrice).toFixed(4)}
            </p>
            <p className="text-xs text-muted-foreground">Formula {result.formulaVersion}</p>
          </div>
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">
          No calculation yet. Open the calculator to preview a trade.
        </p>
      )}
    </Section>
  )
}

export function ReferenceDataPage() {
  const [includeArchived, setIncludeArchived] = useState(false)
  const mutation = useReferenceMutation()
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ['reference-data', includeArchived],
    queryFn: () => fetchReferenceData(includeArchived),
  })

  if (isPending) {
    return <p className="text-sm text-muted-foreground">Loading trading setup…</p>
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>The API is unreachable</CardTitle>
          <CardDescription>{error.message}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" onClick={() => void refetch()}>
            Try again
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Trading setup</h1>
            <p className="text-sm text-muted-foreground">
              Configure the reference data used by the trading journal. All values stay on this
              device.
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(event) => setIncludeArchived(event.target.checked)}
              className="size-4 rounded border-border"
            />
            Show archived
          </label>
        </div>
      </header>

      <CalculatorSection instruments={data.instruments} />
      <AccountsSection accounts={data.accounts} mutation={mutation} />
      <InstrumentsSection instruments={data.instruments} mutation={mutation} />
      <TagsSection tags={data.tags} mutation={mutation} />
      <SessionsSection sessions={data.tradingSessions} mutation={mutation} />
      <ChecklistSection checklist={data.checklist} mutation={mutation} />
    </div>
  )
}
