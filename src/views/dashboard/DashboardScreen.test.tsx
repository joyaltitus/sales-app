import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { DashboardScreen } from './DashboardScreen'

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

describe('DashboardScreen', () => {
  it('opens with actionable operations and keeps revenue and owner reporting separate', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><DashboardScreen /></MemoryRouter>)

    expect(screen.getByRole('heading', { name: 'What needs attention today' })).toBeInTheDocument()
    expect(screen.queryByText('The business, at a glance.')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Revenue' }))
    expect(screen.getByText('Open pipeline')).toBeInTheDocument()
    expect(screen.getByText('Pipeline by stage')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Business report' }))
    expect(await screen.findByText('The business, at a glance.')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'What needs attention today' })).not.toBeInTheDocument()
  })
})
