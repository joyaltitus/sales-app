import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { DashboardScreen } from './DashboardScreen'
import { MOCK_METRICS, MOCK_ROI } from '../preview/preview-mocks'

vi.mock('../../shell/ClientProvider', () => ({
  useClient: () => ({ activeClient: { id: 'client-1', role: 'manager' } }),
}))

vi.mock('../../lib/inbox-data', () => ({
  useQueue: () => ({
    items: [
      { id: 'conversation-1', status: 'open', bot_paused: true, escalation_resolved: false },
      { id: 'conversation-2', status: 'open', bot_paused: false, escalation_resolved: false },
    ],
    loading: false,
  }),
}))

vi.mock('../../lib/leads-data', () => ({
  useLeads: () => ({
    items: [
      { id: 'lead-1', status: 'open', stage_id: 'qualified', est_value: 60000 },
      { id: 'lead-2', status: 'won', stage_id: 'won', est_value: 85000 },
    ],
    loading: false,
  }),
  useLeadStages: () => ({
    stages: [
      { id: 'qualified', label: 'Qualified' },
      { id: 'won', label: 'Won' },
    ],
  }),
  useFollowUps: () => ({
    items: [{ id: 'followup-1', due_at: new Date(Date.now() - 60_000).toISOString() }],
  }),
}))

vi.mock('../../lib/crm-data', () => ({
  useBookings: () => ({ items: [{ id: 'booking-1', created_at: new Date().toISOString() }] }),
}))

// The owner report is a lazy child with its own reads; this file is about the
// dashboard's view switching, so its sources are stubbed rather than dialled.
// OwnerBusinessReport.test.tsx is where the report's own numbers are checked.
vi.mock('../../lib/metrics-data', () => ({
  useMetrics: () => ({ data: MOCK_METRICS, loading: false, error: null }),
}))
vi.mock('../../lib/attribution-data', () => ({
  useCampaignRoi: () => ({ items: MOCK_ROI, loading: false, error: null, reload: vi.fn() }),
}))
vi.mock('../../lib/targets-data', () => ({
  firstOfMonth: () => '2026-09-01',
  useTeamTargets: () => ({ items: [], loading: false, reload: vi.fn() }),
}))

describe('DashboardScreen', () => {
  // 20s, not the 5s default: the report tab is a lazy() boundary, so this test
  // waits on a real dynamic import being transformed. That takes well past a
  // second when the whole suite is competing for the same transform pipeline,
  // and a timeout there is a slow machine, not a broken screen.
  it('opens with actionable operations and keeps revenue and owner reporting separate', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><DashboardScreen /></MemoryRouter>)

    expect(screen.getByRole('heading', { name: 'What needs attention today' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Business report', level: 2 })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Revenue' }))
    expect(screen.getByText('Open pipeline')).toBeInTheDocument()
    expect(screen.getByText('Pipeline by stage')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Business report' }))
    expect(
      await screen.findByRole('heading', { name: 'Business report', level: 2 }, { timeout: 15_000 }),
    ).toBeInTheDocument()
    // The report's own numbers, not the operating dashboard's.
    expect(screen.getByText('Return on spend')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'What needs attention today' })).not.toBeInTheDocument()
  }, 20_000)
})
