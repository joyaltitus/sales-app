import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockUseClient } = vi.hoisted(() => ({ mockUseClient: vi.fn() }))

vi.mock('../../shell/ClientProvider', () => ({ useClient: mockUseClient }))
vi.mock('../../auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'user-1' } } }) }))
vi.mock('../../lib/crm-data', () => ({ useContacts: () => ({ items: [], reload: vi.fn() }), downloadCsv: vi.fn() }))
vi.mock('../../lib/leads-data', () => ({
  useLeads: () => ({ items: [], loading: false, error: null, reload: vi.fn() }),
  useLeadStages: () => ({ stages: [], loading: false }),
  useFollowUps: () => ({ items: [] }),
  moveLeadStage: vi.fn(),
}))
vi.mock('../../lib/temperature', () => ({ leadTemperature: () => ({ temp: 'warm' }) }))
vi.mock('../../ui/Avatar', () => ({ Avatar: () => null }))
vi.mock('../../ui/Chip', () => ({ Chip: () => null }))
vi.mock('../../ui/Sheet', () => ({ Sheet: () => null }))
vi.mock('../../ui/EmptyState', () => ({ EmptyState: () => null }))
vi.mock('../../ui/Skeleton', () => ({ Skeleton: () => null }))
vi.mock('../../ui/Button', () => ({ Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props} /> }))
vi.mock('../calls/CallButton', () => ({ CallButton: () => null }))
vi.mock('./RelationshipTimeline', () => ({ RelationshipTimeline: () => null }))
vi.mock('./AddLeadModal', () => ({ AddLeadModal: () => null }))
vi.mock('../leads/LeadRow', () => ({ LeadRow: () => null }))
vi.mock('./PipelineStrip', () => ({ PipelineStrip: () => null }))
vi.mock('./BoardView', () => ({ BoardView: () => null }))
vi.mock('./LeadDrawer', () => ({ LeadDrawer: () => null }))

const { ContactsTab } = await import('./ContactsTab')
const { LeadsScreen } = await import('../leads/LeadsScreen')

describe('manual lead role gate', () => {
  beforeEach(() => {
    mockUseClient.mockReturnValue({
      activeClient: { id: 'client-1', name: 'Demo', vertical: 'education', role: 'agent' },
    })
  })

  it('does not offer conversation-less manual lead creation to agents', () => {
    const { unmount } = render(<ContactsTab />)
    expect(screen.queryByRole('button', { name: 'Add Lead' })).not.toBeInTheDocument()
    unmount()

    render(<LeadsScreen crm />)
    expect(screen.queryByRole('button', { name: 'Add Lead' })).not.toBeInTheDocument()
  })

  it('offers manual lead creation to managers', () => {
    mockUseClient.mockReturnValue({
      activeClient: { id: 'client-1', name: 'Demo', vertical: 'education', role: 'manager' },
    })

    render(<ContactsTab />)
    expect(screen.getByRole('button', { name: 'Add Lead' })).toBeInTheDocument()
  })
})
