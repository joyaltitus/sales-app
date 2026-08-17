import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LeadStage } from '../../lib/leads-data'

const { createLead } = vi.hoisted(() => ({
  createLead: vi.fn(),
}))

vi.mock('../../lib/crm-actions', () => ({
  createLead,
}))

vi.mock('../../auth/AuthProvider', () => ({
  useAuth: () => ({ session: { user: { email: 'rep@example.com' } } }),
}))

const { AddLeadModal } = await import('./AddLeadModal')

const sampleStages: LeadStage[] = [
  { id: 'stage-1', stage_key: 'discovery', label: 'Discovery', sort_order: 1, is_won: false },
  { id: 'stage-2', stage_key: 'qualified', label: 'Qualified', sort_order: 2, is_won: false },
  { id: 'stage-3', stage_key: 'won', label: 'Won', sort_order: 3, is_won: true },
]

describe('AddLeadModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when closed', () => {
    render(
      <AddLeadModal
        open={false}
        onClose={vi.fn()}
        onCreated={vi.fn()}
        clientId="client-1"
        stages={sampleStages}
      />,
    )

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders all form fields and preset chips when open', () => {
    render(
      <AddLeadModal
        open={true}
        onClose={vi.fn()}
        onCreated={vi.fn()}
        clientId="client-1"
        stages={sampleStages}
      />,
    )

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('e.g. Rahul Sharma')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('e.g. 98765 43210')).toBeInTheDocument()
    expect(screen.getByText('₹50K')).toBeInTheDocument()
    expect(screen.getByText('₹60K')).toBeInTheDocument()
  })

  it('populates estimated value when clicking a preset chip', async () => {
    const user = userEvent.setup()

    render(
      <AddLeadModal
        open={true}
        onClose={vi.fn()}
        onCreated={vi.fn()}
        clientId="client-1"
        stages={sampleStages}
      />,
    )

    await user.click(screen.getByRole('button', { name: '₹60K' }))
    expect(screen.getByPlaceholderText('60,000')).toHaveValue('60000')
  })

  it('submits valid form and invokes onCreated callback', async () => {
    const user = userEvent.setup()
    const onCreated = vi.fn()
    const onClose = vi.fn()
    createLead.mockResolvedValue({ ok: true, leadId: 'lead-123' })

    render(
      <AddLeadModal
        open={true}
        onClose={onClose}
        onCreated={onCreated}
        clientId="client-1"
        stages={sampleStages}
      />,
    )

    await user.type(screen.getByPlaceholderText('e.g. Rahul Sharma'), 'Rahul Sharma')
    await user.type(screen.getByPlaceholderText('e.g. 98765 43210'), '9876543210')
    await user.click(screen.getByRole('button', { name: '₹50K' }))
    await user.type(
      screen.getByPlaceholderText('e.g. Schedule counseling call for NEET batch'),
      'Call tomorrow at 10 AM',
    )

    await user.click(screen.getByRole('button', { name: 'Create Lead' }))

    await waitFor(() => {
      expect(createLead).toHaveBeenCalledWith('client-1', {
        profileName: 'Rahul Sharma',
        phone: '9876543210',
        channel: 'phone',
        stageId: 'stage-1',
        estValue: 50000,
        nextAction: 'Call tomorrow at 10 AM',
        note: null,
        authorEmail: 'rep@example.com',
      })
      expect(onCreated).toHaveBeenCalledWith('lead-123')
      expect(onClose).toHaveBeenCalled()
    })
  })

  it('displays error banner if lead creation fails', async () => {
    const user = userEvent.setup()
    createLead.mockResolvedValue({ ok: false, message: 'RLS denied: contact already exists in another scope.' })

    render(
      <AddLeadModal
        open={true}
        onClose={vi.fn()}
        onCreated={vi.fn()}
        clientId="client-1"
        stages={sampleStages}
      />,
    )

    await user.type(screen.getByPlaceholderText('e.g. 98765 43210'), '9876543210')
    await user.click(screen.getByRole('button', { name: 'Create Lead' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'RLS denied: contact already exists in another scope.',
    )
  })
})
