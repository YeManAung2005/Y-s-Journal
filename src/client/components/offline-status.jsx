import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/lib/auth-context'
import { unlockOfflineSession } from '@/offline/manager.js'
import { listOperations } from '@/offline/store.js'
import { useOffline } from '@/offline/use-offline.js'

function statusView(status) {
  if (!status.online) return { label: 'Offline', variant: 'danger' }
  if (status.syncing) return { label: 'Syncing', variant: 'default' }
  if (status.conflicts > 0) return { label: 'Conflict', variant: 'danger' }
  if (status.blocked > 0) return { label: 'Blocked', variant: 'danger' }
  if (status.pending > 0) return { label: 'Pending', variant: 'secondary' }
  return { label: 'Synced', variant: 'success' }
}

function describeOperation(operation) {
  const version = operation.body?.expectedVersion
  return `${operation.method} ${operation.path}${version === undefined ? '' : ` · v${version}`}`
}

export function OfflineStatus() {
  const { user } = useAuth()
  const status = useOffline()
  const [password, setPassword] = useState('')
  const [unlockError, setUnlockError] = useState('')
  const [operations, setOperations] = useState([])
  const [reviewId, setReviewId] = useState(null)
  const [reviewText, setReviewText] = useState('')

  const loadOperations = useCallback(async () => {
    if (!status.unlocked) {
      setOperations([])
      return
    }
    try {
      setOperations(await listOperations())
    } catch {
      setOperations([])
    }
  }, [status.unlocked])

  useEffect(() => {
    // Queue state lives outside React; refreshing it here keeps the review list in sync.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadOperations()
  }, [loadOperations, status.pending, status.conflicts, status.blocked])

  const view = statusView(status)
  const conflicts = operations.filter((operation) => operation.status === 'conflict')
  const blocked = operations.filter((operation) => operation.status === 'blocked')

  const handleUnlock = async (event) => {
    event.preventDefault()
    setUnlockError('')
    try {
      await unlockOfflineSession({ password, userId: user?.id, email: user?.email })
      setPassword('')
    } catch (error) {
      setUnlockError(error?.message || 'Could not unlock the offline cache.')
    }
  }

  const handleAction = async (operation, action) => {
    try {
      if (action === 'merge') {
        const body = JSON.parse(reviewText)
        await status.resolveConflictAction({ id: operation.id, action, body })
      } else {
        await status.resolveConflictAction({ id: operation.id, action })
      }
      setReviewId(null)
      setReviewText('')
      await loadOperations()
    } catch (error) {
      setUnlockError(error?.message || 'The change could not be applied.')
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card/60 px-3 py-2">
        <Badge variant={view.variant}>{view.label}</Badge>
        <span className="text-xs text-muted-foreground">
          {status.pending > 0 ? `${status.pending} pending · ` : ''}
          {status.conflicts > 0 ? `${status.conflicts} conflict · ` : ''}
          {status.blocked > 0 ? `${status.blocked} blocked · ` : ''}
          Cached data stays encrypted until you unlock this device.
        </span>
        {(status.pending > 0 || status.conflicts > 0 || status.blocked > 0) && status.online ? (
          <Button size="sm" variant="outline" onClick={() => void status.syncNow()}>
            Sync now
          </Button>
        ) : null}
      </div>

      {status.quotaError ? (
        <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          {status.quotaError}
        </p>
      ) : null}

      {!status.unlocked ? (
        <form
          onSubmit={(event) => void handleUnlock(event)}
          className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-card/60 px-3 py-3"
        >
          <div className="min-w-48 flex-1 space-y-1">
            <Label htmlFor="offline-unlock-password">Unlock offline cache</Label>
            <Input
              id="offline-unlock-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Your journal password"
            />
          </div>
          <Button type="submit" size="sm" disabled={!password}>
            Unlock
          </Button>
          {unlockError ? <p className="w-full text-xs text-danger">{unlockError}</p> : null}
        </form>
      ) : null}

      {conflicts.length > 0 ? (
        <div className="space-y-2 rounded-lg border border-danger/30 bg-danger/5 px-3 py-3">
          <p className="text-sm font-medium text-danger">Changes need your review</p>
          {conflicts.map((operation) => (
            <div key={operation.id} className="space-y-2 border-t border-danger/20 pt-2">
              <p className="text-xs font-medium">{describeOperation(operation)}</p>
              <p className="text-xs text-muted-foreground">
                {operation.error?.message || 'The server changed this record.'} Your version is kept
                locally until you choose.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void handleAction(operation, 'keep-server')}
                >
                  Keep server
                </Button>
                <Button size="sm" onClick={() => void handleAction(operation, 'use-mine')}>
                  Use mine
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void handleAction(operation, 'discard')}
                >
                  Discard
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setReviewId(operation.id)
                    setReviewText(
                      typeof operation.body === 'object' && operation.body !== null
                        ? JSON.stringify(operation.body, null, 2)
                        : '',
                    )
                  }}
                >
                  Merge manually
                </Button>
              </div>
              {reviewId === operation.id ? (
                <div className="space-y-2">
                  <Textarea
                    value={reviewText}
                    onChange={(event) => setReviewText(event.target.value)}
                    rows={5}
                    aria-label="Merged payload"
                  />
                  <Button size="sm" onClick={() => void handleAction(operation, 'merge')}>
                    Retry merged payload
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {blocked.length > 0 ? (
        <div className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
          {blocked.map((operation) => (
            <p key={operation.id}>
              Blocked: {describeOperation(operation)} — {operation.error?.message}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  )
}
