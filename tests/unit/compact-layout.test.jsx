// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
}))

vi.mock('@/lib/auth-context', () => ({
  useAuth: mocks.useAuth,
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, activeProps: _activeProps, activeOptions: _activeOptions, ...props }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('@/features/reference/reference-api')
vi.mock('@/features/analytics/analytics-api')
vi.mock('@/features/learning/learning-api')
vi.mock('@/features/journal/journal-api')

import { AppShell } from '../../src/client/components/app-shell.jsx'
import { AccountAdjustments } from '../../src/client/features/analytics/account-adjustments.jsx'
import { AnalyticsPage } from '../../src/client/features/analytics/analytics-page.jsx'
import {
  fetchAccountAdjustments,
  fetchAnalyticsBreakdowns,
  fetchAnalyticsEquity,
  fetchAnalyticsSummary,
} from '../../src/client/features/analytics/analytics-api'
import { fetchJournalEntries, fetchQuickNotes } from '../../src/client/features/journal/journal-api'
import {
  fetchLearningCategories,
  fetchLearningGoals,
  fetchLearningRecords,
  fetchLearningSummary,
} from '../../src/client/features/learning/learning-api'
import { fetchReferenceData } from '../../src/client/features/reference/reference-api'
import { JournalPage } from '../../src/client/features/journal/journal-page.jsx'
import {
  fetchLearningCategories as fetchLearningCategoriesForPage,
  fetchLearningGoals as fetchLearningGoalsForPage,
  fetchLearningRecords as fetchLearningRecordsForPage,
  fetchLearningSummary as fetchLearningSummaryForPage,
} from '../../src/client/features/learning/learning-api'
import { LearningPage } from '../../src/client/features/learning/learning-page.jsx'
import { ReferenceDataPage } from '../../src/client/features/reference/reference-data-page.jsx'

function renderWithClient(ui) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

const referenceData = {
  accounts: [
    {
      id: 'acct-1',
      name: 'Main Account',
      broker: '',
      accountType: 'live',
      startingBalanceMicros: 0,
      isDefault: true,
    },
  ],
  instruments: [
    {
      id: 'inst-1',
      symbol: 'NQ',
      name: 'Nasdaq 100',
      tickSizeMicros: 250000,
      tickValueMicros: 5000000,
      pointValueMicros: 20000000,
      active: true,
      builtIn: true,
    },
  ],
  tags: [],
  tradingSessions: [],
  checklist: [],
}

const analyticsSummary = {
  basis: 'net',
  tradeCount: 0,
  totalPnlMicros: 0,
  winRate: null,
  profitFactor: null,
  averageR: null,
  averageWinMicros: null,
  averageLossMicros: null,
  maxDrawdownMicros: 0,
  wins: 0,
  losses: 0,
  breakEvens: 0,
  winningDays: 0,
  losingDays: 0,
  streaks: {
    currentWinningStreak: 0,
    currentLosingStreak: 0,
    longestWinningStreak: 0,
    longestLosingStreak: 0,
  },
  grossPnlMicros: 0,
  coverage: {
    missingNetCount: 0,
    missingRiskCount: 0,
    rAvailable: 0,
    grossAvailable: 0,
  },
}

const learningCategories = [
  {
    id: 'cat-1',
    name: 'Trading',
    color: '#8b5cf6',
    slug: 'trading',
    version: 1,
    archivedAt: null,
  },
]

const learningSummary = {
  today: '2026-11-26',
  days: [],
  dailyTargetMinutes: 60,
  todayMinutes: 0,
  targetMetToday: false,
  currentStreak: 0,
  longestStreak: 0,
  lastStudyDate: null,
  qualifyingDays: 0,
  totalMinutes: 0,
  recordCount: 0,
  activeDays: 0,
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
  mocks.useAuth.mockReturnValue({
    user: { displayName: 'Owner', email: 'owner@example.test' },
    settings: { appTimeZone: 'Asia/Yangon', reminders: {} },
    saveSettings: vi.fn(),
    lock: vi.fn(),
    signOut: vi.fn(),
  })

  vi.mocked(fetchReferenceData).mockResolvedValue(referenceData)
  vi.mocked(fetchAnalyticsSummary).mockResolvedValue({ summary: analyticsSummary })
  vi.mocked(fetchAnalyticsEquity).mockResolvedValue({
    equity: {
      points: [],
      startingBalanceMicros: 0,
      accountBalanceMicros: null,
      cumulativeNetPnlMicros: 0,
    },
  })
  vi.mocked(fetchAnalyticsBreakdowns).mockResolvedValue({ breakdowns: [] })
  vi.mocked(fetchAccountAdjustments).mockResolvedValue({ adjustments: [] })
  vi.mocked(fetchJournalEntries).mockResolvedValue({ entries: [] })
  vi.mocked(fetchQuickNotes).mockResolvedValue({ notes: [] })
  vi.mocked(fetchLearningCategories).mockResolvedValue({ categories: learningCategories })
  vi.mocked(fetchLearningGoals).mockResolvedValue({ goals: [] })
  vi.mocked(fetchLearningRecords).mockResolvedValue({ records: [] })
  vi.mocked(fetchLearningSummary).mockResolvedValue({ summary: learningSummary })
  vi.mocked(fetchLearningCategoriesForPage).mockResolvedValue({ categories: learningCategories })
  vi.mocked(fetchLearningGoalsForPage).mockResolvedValue({ goals: [] })
  vi.mocked(fetchLearningRecordsForPage).mockResolvedValue({ records: [] })
  vi.mocked(fetchLearningSummaryForPage).mockResolvedValue({ summary: learningSummary })
})

describe('compact page layout', () => {
  it('removes Calendar from desktop and mobile navigation', () => {
    render(<AppShell />)

    expect(screen.queryByRole('link', { name: 'Calendar' })).not.toBeInTheDocument()
    expect(document.querySelector('a[href="/calendar"]')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Learning' })).toBeInTheDocument()
  })

  it('opens Trading setup in view mode and reveals forms only on demand', async () => {
    renderWithClient(<ReferenceDataPage />)

    expect(await screen.findByText('Financial calculator')).toBeInTheDocument()
    expect(
      screen.getByText('No calculation yet. Open the calculator to preview a trade.'),
    ).toBeInTheDocument()
    expect(screen.queryByText('Entry price')).not.toBeInTheDocument()
    expect(screen.queryByText('Broker')).not.toBeInTheDocument()
    expect(screen.queryByText('Checklist item')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Add account' }))
    expect(screen.getByPlaceholderText('Main Account')).toBeInTheDocument()
    expect(screen.queryByText('Broker')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Show optional fields' }))
    expect(screen.getByPlaceholderText('Optional')).toBeInTheDocument()
  })

  it('opens Analytics with metrics first and the adjustment form hidden', async () => {
    renderWithClient(<AnalyticsPage />)

    expect(await screen.findByText('Trading analytics')).toBeInTheDocument()
    expect(screen.getByText('Performance summary')).toBeInTheDocument()
    expect(screen.queryByLabelText('Type')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add adjustment' })).toBeInTheDocument()
  })

  it('opens account adjustments in view mode with note hidden', async () => {
    renderWithClient(<AccountAdjustments accounts={referenceData.accounts} />)

    expect(await screen.findByText('No adjustments recorded for this account.')).toBeInTheDocument()
    expect(screen.queryByText('Type')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Add adjustment' }))
    expect(screen.getByLabelText('Type')).toBeInTheDocument()
    expect(screen.queryByLabelText('Note')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Show optional fields' }))
    expect(screen.getByLabelText('Note')).toBeInTheDocument()
  })

  it('opens Learning in view mode with category, record, and goal forms hidden', async () => {
    renderWithClient(<LearningPage />)

    expect(await screen.findByText('Study rhythm')).toBeInTheDocument()
    expect(screen.queryByText('New category')).not.toBeInTheDocument()
    expect(screen.queryByText('Linked goal')).not.toBeInTheDocument()
    expect(screen.queryByText('New learning goal')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Add category' }))
    expect(screen.getByPlaceholderText('Web development')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Hide form' }))
    fireEvent.click(screen.getByRole('button', { name: 'New record' }))
    expect(screen.getByPlaceholderText('React hooks and state management')).toBeInTheDocument()
    expect(screen.queryByText('Linked goal')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Show optional fields' }))
    expect(screen.getByText('Linked goal')).toBeInTheDocument()
  })

  it('opens Daily Journal in view mode with entry and quick-note forms hidden', async () => {
    renderWithClient(<JournalPage />)

    expect(await screen.findByText('No entry for today yet')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save today’s entry' })).not.toBeInTheDocument()
    expect(screen.queryByText('Mood')).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText('A thought, a reminder, an idea…')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Write today’s entry' }))
    expect(screen.getByText('Free writing')).toBeInTheDocument()
    expect(screen.queryByText('Mood')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Show optional fields' }))
    expect(screen.getByText('Mood')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Add note' }))
    expect(screen.getByPlaceholderText('A thought, a reminder, an idea…')).toBeInTheDocument()
  })
})
