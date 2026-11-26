import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { apiRequest, ApiError, ensureCsrf, resetCsrfToken } from './api.js'
import {
  changeOfflinePassword,
  lockOfflineSession,
  signOutOfflineSession,
  syncNow,
  unlockOfflineSession,
} from '../offline/manager.js'
import { getOfflineProfile } from '../offline/store.js'
import { AUTO_LOCK_MS, IDLE_CHECK_INTERVAL_MS, isIdleExpired } from './idle.js'

const AuthContext = createContext(null)

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll']

const initialState = {
  status: 'loading',
  user: null,
  settings: null,
  session: null,
  error: null,
  offline: false,
  localProfile: null,
}

function resolveTheme(theme) {
  if (theme === 'system') {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return theme === 'light' ? 'light' : 'dark'
}

function offlineUser(profile) {
  if (!profile?.userId) return null
  return {
    id: profile.userId,
    email: profile.email ?? null,
    displayName: profile.displayName || profile.email || 'Owner',
    role: 'owner',
  }
}

export function AuthProvider({ children }) {
  const [state, setState] = useState(initialState)
  const lastActivityRef = useRef(0)

  const loadSession = useCallback(async () => {
    try {
      await ensureCsrf()
      const setup = await apiRequest('/onboarding/status')

      if (setup.setupRequired) {
        setState({ ...initialState, status: 'setup' })
        return
      }

      try {
        const session = await apiRequest('/auth/session')
        const settings = await apiRequest('/settings')
        lastActivityRef.current = Date.now()
        setState({
          status: 'authenticated',
          user: session.user,
          session: session.session,
          settings: settings.settings,
          error: null,
          offline: false,
          localProfile: null,
        })
        void syncNow()
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          setState({ ...initialState, status: 'unauthenticated' })
          return
        }
        throw error
      }
    } catch (error) {
      const networkFailure = !(error instanceof ApiError)
      const profile = networkFailure ? await getOfflineProfile().catch(() => null) : null

      if (profile) {
        setState({
          ...initialState,
          status: 'locked',
          offline: true,
          localProfile: profile,
        })
        return
      }

      setState({ ...initialState, status: 'error', error })
    }
  }, [])

  useEffect(() => {
    // Initial auth bootstrap is an intentional one-time synchronization with the local API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSession()
  }, [loadSession])

  const lock = useCallback(() => {
    if (state.status !== 'authenticated') return
    lockOfflineSession()
    setState((current) =>
      current.status === 'authenticated'
        ? { ...current, status: 'locked', offline: false, localProfile: null }
        : current,
    )
  }, [state.status])

  useEffect(() => {
    if (state.status !== 'authenticated') return undefined

    const bump = () => {
      lastActivityRef.current = Date.now()
    }

    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, bump, { passive: true }))

    const interval = window.setInterval(() => {
      if (isIdleExpired(lastActivityRef.current, Date.now(), AUTO_LOCK_MS)) {
        lock()
      }
    }, IDLE_CHECK_INTERVAL_MS)

    const onVisibility = () => {
      if (
        document.visibilityState === 'visible' &&
        isIdleExpired(lastActivityRef.current, Date.now(), AUTO_LOCK_MS)
      ) {
        lock()
      }
    }

    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, bump))
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [state.status, lock])

  useEffect(() => {
    const settings = state.settings
    if (!settings) return undefined

    const root = document.documentElement
    const theme = resolveTheme(settings.theme)

    root.classList.toggle('dark', theme === 'dark')
    root.classList.toggle('light', theme === 'light')
    root.dataset.theme = theme
    root.style.colorScheme = theme
    root.style.fontSize = `${16 * settings.fontScale}px`
    root.classList.toggle('reduce-motion', Boolean(settings.reducedMotion))

    if (settings.theme !== 'system') return undefined

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      const next = resolveTheme('system')
      root.classList.toggle('dark', next === 'dark')
      root.classList.toggle('light', next === 'light')
      root.dataset.theme = next
      root.style.colorScheme = next
    }

    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [state.settings])

  const signIn = useCallback(async ({ email, password }) => {
    const data = await apiRequest('/auth/login', {
      method: 'POST',
      body: { email, password },
    })
    const settings = await apiRequest('/settings')
    await unlockOfflineSession({
      password,
      userId: data.user.id,
      email: data.user.email,
      displayName: data.user.displayName,
    })
    lastActivityRef.current = Date.now()
    setState({
      status: 'authenticated',
      user: data.user,
      session: null,
      settings: settings.settings,
      error: null,
      offline: false,
      localProfile: null,
    })
    void syncNow()
  }, [])

  const completeOnboarding = useCallback(async (payload) => {
    const data = await apiRequest('/onboarding', { method: 'POST', body: payload })
    const settings = await apiRequest('/settings')
    await unlockOfflineSession({
      password: payload.password,
      userId: data.user.id,
      email: data.user.email,
      displayName: data.user.displayName,
    })
    lastActivityRef.current = Date.now()
    setState({
      status: 'authenticated',
      user: data.user,
      session: null,
      settings: settings.settings,
      error: null,
      offline: false,
      localProfile: null,
    })
  }, [])

  const unlock = useCallback(
    async (password) => {
      const profile = state.localProfile ?? (await getOfflineProfile().catch(() => null))
      let serverUnavailable = false

      try {
        await apiRequest('/auth/unlock', { method: 'POST', body: { password } })
      } catch (error) {
        serverUnavailable = !(error instanceof ApiError)
        if (!serverUnavailable) throw error
        if (!profile) throw error

        try {
          await unlockOfflineSession({ password, profile })
        } catch {
          throw new ApiError('The password is incorrect.', {
            status: 401,
            code: 'INVALID_PASSWORD',
          })
        }
      }

      if (!serverUnavailable) {
        await unlockOfflineSession({
          password,
          userId: state.user?.id ?? profile?.userId,
          email: state.user?.email ?? profile?.email,
          displayName: state.user?.displayName ?? profile?.displayName,
        })
      }

      lastActivityRef.current = Date.now()
      setState((current) => ({
        ...current,
        user: current.user ?? offlineUser(profile),
        status: 'authenticated',
        offline: false,
        localProfile: null,
      }))
      void syncNow()
    },
    [state.localProfile, state.user],
  )

  const signOut = useCallback(async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' })
    } catch {
      // The local session is cleared regardless of server availability.
    }
    resetCsrfToken()
    await signOutOfflineSession()
    setState({ ...initialState, status: 'unauthenticated' })
  }, [])

  const saveSettings = useCallback(async (patch) => {
    const data = await apiRequest('/settings', { method: 'PATCH', body: patch })
    setState((current) => ({ ...current, settings: data.settings }))
    return data.settings
  }, [])

  const changePassword = useCallback(async (payload) => {
    await apiRequest('/auth/password', { method: 'POST', body: payload })
    await changeOfflinePassword({
      currentPassword: payload.currentPassword,
      newPassword: payload.newPassword,
    })
  }, [])

  const value = useMemo(
    () => ({
      ...state,
      lock,
      unlock,
      signIn,
      signOut,
      completeOnboarding,
      saveSettings,
      changePassword,
      syncNow,
      retry: loadSession,
    }),
    [
      state,
      lock,
      unlock,
      signIn,
      signOut,
      completeOnboarding,
      saveSettings,
      changePassword,
      loadSession,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider.')
  }
  return context
}

export function useCurrentUser() {
  return useAuth().user
}
