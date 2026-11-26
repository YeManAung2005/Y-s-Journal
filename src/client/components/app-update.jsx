import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const AppUpdateContext = createContext(null)

export function AppUpdateProvider({ children }) {
  const registration = useRegisterSW()
  const [needRefresh] = registration.needRefresh
  const [offlineReady] = registration.offlineReady
  const { updateServiceWorker } = registration
  const [checking, setChecking] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)

  const checkForUpdates = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.serviceWorker) {
      setError('This browser does not support app-shell updates.')
      return
    }

    setChecking(true)
    setMessage(null)
    setError(null)
    try {
      const active = await navigator.serviceWorker.getRegistration()
      if (!active) {
        setError('No app shell cache is registered yet. Reload the app once to enable checks.')
        return
      }
      await active.update()
      setMessage('Update check complete.')
    } catch {
      setError('The update check could not be completed.')
    } finally {
      setChecking(false)
    }
  }, [])

  const applyUpdate = useCallback(async () => {
    setUpdating(true)
    setMessage(null)
    setError(null)
    try {
      await updateServiceWorker(true)
    } catch {
      setError('The update could not be applied. Reload the page and try again.')
    } finally {
      setUpdating(false)
    }
  }, [updateServiceWorker])

  const value = useMemo(
    () => ({
      needRefresh,
      offlineReady,
      checkForUpdates,
      applyUpdate,
      checking,
      updating,
      message,
      error,
    }),
    [needRefresh, offlineReady, checkForUpdates, applyUpdate, checking, updating, message, error],
  )

  return <AppUpdateContext.Provider value={value}>{children}</AppUpdateContext.Provider>
}

export function useAppUpdate() {
  const context = useContext(AppUpdateContext)
  if (!context) throw new Error('useAppUpdate must be used inside AppUpdateProvider')
  return context
}

export function AppUpdate() {
  const {
    needRefresh,
    offlineReady,
    checkForUpdates,
    applyUpdate,
    checking,
    updating,
    message,
    error,
  } = useAppUpdate()

  const label = needRefresh ? 'Update ready' : offlineReady ? 'Offline ready' : 'Up to date'
  const variant = needRefresh ? 'secondary' : offlineReady ? 'outline' : 'success'
  const detail = needRefresh
    ? 'A newer app shell is ready to activate.'
    : offlineReady
      ? 'The offline shell is cached and ready.'
      : 'This app is up to date.'

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-secondary/30 p-3">
        <div>
          <p className="text-sm font-medium">App files</p>
          <p className="text-xs text-muted-foreground">{detail}</p>
        </div>
        <Badge variant={variant}>{label}</Badge>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        The app shell is the HTML, CSS, JavaScript, and fonts that draw this workspace. Updating it
        loads a newer build of Y&apos;s Journal. Your trades, learning records, private journal
        entries, and settings are not changed. No install is required.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={checking}
          onClick={() => void checkForUpdates()}
        >
          {checking ? 'Checking…' : 'Check for updates'}
        </Button>
        {needRefresh ? (
          <Button type="button" size="sm" disabled={updating} onClick={() => void applyUpdate()}>
            {updating ? 'Updating…' : 'Update now'}
          </Button>
        ) : null}
      </div>

      {message ? <p className="text-xs text-success">{message}</p> : null}
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  )
}
