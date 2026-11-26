// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  apiRequest: vi.fn(),
}))

vi.mock('@/lib/auth-context', () => ({
  useAuth: mocks.useAuth,
}))

vi.mock('@/lib/api', () => ({
  apiRequest: mocks.apiRequest,
}))

vi.mock('@/components/app-update.jsx', () => ({
  AppUpdate: () => <div>App update body</div>,
}))

vi.mock('@/components/offline-status.jsx', () => ({
  OfflineStatus: () => <div>Offline body</div>,
}))

import { SettingsPage } from '../../src/client/features/settings/settings-page.jsx'

const SECTION_TITLES = [
  'Appearance',
  'Time and goals',
  'Reminders',
  'Offline and sync',
  'Session security',
  'App update',
  'Change password',
  'Security activity',
]

beforeEach(() => {
  mocks.useAuth.mockReturnValue({
    user: { displayName: 'Owner', email: 'owner@example.test' },
    settings: {},
    session: { expiresAt: '2026-11-27T00:00:00.000Z' },
    saveSettings: vi.fn(),
    lock: vi.fn(),
    signOut: vi.fn(),
    changePassword: vi.fn(),
  })
  mocks.apiRequest.mockResolvedValue({ events: [] })
})

describe('SettingsPage layout', () => {
  it('renders every settings section exactly once', () => {
    render(<SettingsPage />)

    for (const title of SECTION_TITLES) {
      expect(screen.getAllByText(title)).toHaveLength(1)
    }
  })
})
