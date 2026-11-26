// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  useOffline: vi.fn(),
  unlockOfflineSession: vi.fn(),
  listOperations: vi.fn(),
  resolveConflictAction: vi.fn(),
}))

vi.mock('@/lib/auth-context', () => ({
  useAuth: mocks.useAuth,
}))

vi.mock('@/offline/manager.js', () => ({
  unlockOfflineSession: mocks.unlockOfflineSession,
}))

vi.mock('@/offline/store.js', () => ({
  listOperations: mocks.listOperations,
}))

vi.mock('@/offline/use-offline.js', () => ({
  useOffline: mocks.useOffline,
}))

import { OfflineStatus } from '../../src/client/components/offline-status.jsx'

function baseStatus(overrides = {}) {
  return {
    online: true,
    unlocked: true,
    pending: 0,
    conflicts: 0,
    blocked: 0,
    syncing: false,
    quotaError: null,
    syncNow: vi.fn(),
    resolveConflictAction: mocks.resolveConflictAction,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.useAuth.mockReturnValue({
    user: { id: 'owner-1', email: 'owner@example.com', displayName: 'Owner' },
  })
  mocks.listOperations.mockResolvedValue([])
})

describe('OfflineStatus', () => {
  it('shows the documented status labels', () => {
    mocks.useOffline.mockReturnValue(baseStatus({ pending: 2 }))
    const { rerender } = render(<OfflineStatus />)
    expect(screen.getByText('Pending')).toBeInTheDocument()
    expect(screen.getByText(/2 pending/)).toBeInTheDocument()

    mocks.useOffline.mockReturnValue(baseStatus({ online: false, pending: 2 }))
    rerender(<OfflineStatus />)
    expect(screen.getByText('Offline')).toBeInTheDocument()
  })

  it('offers explicit conflict choices and keeps local data until resolved', async () => {
    mocks.useOffline.mockReturnValue(baseStatus({ conflicts: 1 }))
    mocks.listOperations.mockResolvedValue([
      {
        id: 'op-1',
        method: 'PATCH',
        path: '/trades/trade-1',
        status: 'conflict',
        body: { title: 'mine', expectedVersion: 3 },
        error: { code: 'VERSION_CONFLICT', message: 'Server changed' },
      },
    ])

    render(<OfflineStatus />)

    expect(await screen.findByText('Changes need your review')).toBeInTheDocument()
    expect(screen.getByText(/PATCH \/trades\/trade-1/)).toBeInTheDocument()
    expect(screen.getByText(/Server changed/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Keep server' }))
    await waitFor(() =>
      expect(mocks.resolveConflictAction).toHaveBeenCalledWith({
        id: 'op-1',
        action: 'keep-server',
      }),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Use mine' }))
    await waitFor(() =>
      expect(mocks.resolveConflictAction).toHaveBeenCalledWith({
        id: 'op-1',
        action: 'use-mine',
      }),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Merge manually' }))
    const textarea = screen.getByLabelText('Merged payload')
    fireEvent.change(textarea, { target: { value: '{"title":"merged","expectedVersion":4}' } })
    fireEvent.click(screen.getByRole('button', { name: 'Retry merged payload' }))
    await waitFor(() =>
      expect(mocks.resolveConflictAction).toHaveBeenCalledWith({
        id: 'op-1',
        action: 'merge',
        body: { title: 'merged', expectedVersion: 4 },
      }),
    )
  })

  it('shows blocked operation details when the cache is unlocked', async () => {
    mocks.useOffline.mockReturnValue(baseStatus({ blocked: 1 }))
    mocks.listOperations.mockResolvedValue([
      {
        id: 'op-2',
        method: 'PATCH',
        path: '/journal/entries/entry-1',
        status: 'blocked',
        body: {},
        error: { code: 'VALIDATION_ERROR', message: 'Invalid payload' },
      },
    ])

    render(<OfflineStatus />)
    expect(
      await screen.findByText(/Blocked: PATCH \/journal\/entries\/entry-1/),
    ).toBeInTheDocument()
    expect(screen.getByText(/Invalid payload/)).toBeInTheDocument()
  })

  it('shows quota errors and the offline unlock form while locked', async () => {
    mocks.useOffline.mockReturnValue(
      baseStatus({
        unlocked: false,
        quotaError: 'Browser storage is full. Pending changes were not discarded.',
      }),
    )

    render(<OfflineStatus />)

    expect(screen.getByText(/Browser storage is full/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Unlock offline cache'), {
      target: { value: 'secure-passphrase-123' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }))

    await waitFor(() =>
      expect(mocks.unlockOfflineSession).toHaveBeenCalledWith({
        password: 'secure-passphrase-123',
        userId: 'owner-1',
        email: 'owner@example.com',
      }),
    )
  })
})
