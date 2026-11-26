// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  needRefresh: false,
  offlineReady: false,
  updateServiceWorker: vi.fn(async () => {}),
}))

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [mocks.needRefresh, () => {}],
    offlineReady: [mocks.offlineReady, () => {}],
    updateServiceWorker: mocks.updateServiceWorker,
  }),
}))

import { AppUpdate, AppUpdateProvider } from '../../src/client/components/app-update.jsx'

beforeEach(() => {
  mocks.needRefresh = false
  mocks.offlineReady = false
  vi.clearAllMocks()
})

function renderUpdate() {
  return render(
    <AppUpdateProvider>
      <AppUpdate />
    </AppUpdateProvider>,
  )
}

describe('AppUpdate', () => {
  it('explains the app shell and keeps the check button clickable', () => {
    renderUpdate()

    expect(screen.getByText('Up to date')).toBeInTheDocument()
    expect(screen.getByText(/HTML, CSS, JavaScript, and fonts/)).toBeInTheDocument()
    expect(
      screen.getByText(/Your trades, learning records, private journal entries/),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Check for updates' }))
    expect(screen.getByText(/does not support app-shell updates/)).toBeInTheDocument()
  })

  it('applies a pending update when the user chooses Update now', async () => {
    mocks.needRefresh = true
    renderUpdate()

    expect(screen.getByText('Update ready')).toBeInTheDocument()
    expect(screen.getByText('A newer app shell is ready to activate.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Update now' }))
    await waitFor(() => expect(mocks.updateServiceWorker).toHaveBeenCalledWith(true))
  })

  it('reports offline readiness without showing an update action', () => {
    mocks.offlineReady = true
    renderUpdate()

    expect(screen.getByText('Offline ready')).toBeInTheDocument()
    expect(screen.getByText('The offline shell is cached and ready.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Update now' })).not.toBeInTheDocument()
  })
})
