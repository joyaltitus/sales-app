import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LeadItem } from '../../lib/leads-data'

/**
 * AT-33 — the rep sees their own queue.
 *
 * WHAT THIS TEST IS NOT: a wall test. `leads` SELECT is tenant-wide under RLS
 * for every role, deliberately (MASTER-PLAN §B) — the extension and the
 * assignment controls both have to resolve rows a rep does not own. So this
 * proves the FILTER, which is product behaviour, and says nothing about the
 * wall, which is migration 035's job and is tested where it lives.
 *
 * The scoping rule under test is rep_queue_v's own owner resolution:
 *   COALESCE(leads.owner_id, conversations.assigned_to, leads.created_by)
 * A rep sees a row when that resolves to them, or to nobody.
 */

const { mockUseClient, leadsMock } = vi.hoisted(() => ({
  mockUseClient: vi.fn(),
  leadsMock: { items: [] as LeadItem[] },
}))

vi.mock('../../shell/ClientProvider', () => ({ useClient: mockUseClient }))
vi.mock('../../auth/AuthProvider', () => ({
  useAuth: () => ({ session: { user: { id: 'rep-1' } } }),
}))
vi.mock('../../lib/crm-data', () => ({
  useContacts: () => ({ items: [], reload: vi.fn() }),
  downloadCsv: vi.fn(),
}))
vi.mock('../../lib/leads-data', () => ({
  useLeads: () => ({ items: leadsMock.items, loading: false, error: null, reload: vi.fn() }),
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
vi.mock('../../ui/Button', () => ({
  Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props} />,
}))
vi.mock('../calls/CallButton', () => ({ CallButton: () => null }))
vi.mock('../crm/RelationshipTimeline', () => ({ RelationshipTimeline: () => null }))
vi.mock('../crm/AddLeadModal', () => ({ AddLeadModal: () => null }))
vi.mock('../crm/PipelineStrip', () => ({ PipelineStrip: () => null }))
vi.mock('../crm/LeadDrawer', () => ({ LeadDrawer: () => null }))
vi.mock('./LeadRow', () => ({ LeadRow: () => null }))

// The board is the one place the FILTERED list lands, so it is the honest place
// to read the result from — not a re-implementation of the filter in the test.
vi.mock('../crm/BoardView', () => ({
  BoardView: ({ items }: { items: LeadItem[] }) => (
    <ul data-testid="board">
      {items.map((l) => (
        <li key={l.id}>{l.id}</li>
      ))}
    </ul>
  ),
}))

const { LeadsScreen } = await import('./LeadsScreen')

function lead(id: string, over: Partial<LeadItem> = {}): LeadItem {
  return {
    id,
    contact_id: `c-${id}`,
    conversation_id: `conv-${id}`,
    stage_id: 'stage-1',
    status: 'open',
    est_value: 1000,
    temperature_override: null,
    next_action: null,
    objection: null,
    lost_reason: null,
    updated_at: '2026-09-01T10:00:00Z',
    owner_id: null,
    created_by: null,
    contact: { profile_name: id, channel: 'whatsapp', external_id: '+910000000000' },
    conversation: { assigned_to: null, last_customer_message_at: null },
    ...over,
  }
}

const ROWS: LeadItem[] = [
  lead('owned-by-me', { owner_id: 'rep-1' }),
  lead('assigned-to-me', { conversation: { assigned_to: 'rep-1', last_customer_message_at: null } }),
  lead('created-by-me', { created_by: 'rep-1' }),
  lead('nobodys'),
  lead('owned-by-someone-else', { owner_id: 'rep-2' }),
  lead('assigned-to-someone-else', {
    conversation: { assigned_to: 'rep-2', last_customer_message_at: null },
  }),
  // The case the old filter got wrong in the OTHER direction: explicitly mine,
  // but the thread sits with a colleague. owner_id wins, as it does in the view.
  lead('mine-thread-theirs', {
    owner_id: 'rep-1',
    conversation: { assigned_to: 'rep-2', last_customer_message_at: null },
  }),
  // And this one: created by me, but since owned by someone else. Not mine.
  lead('handed-over', { owner_id: 'rep-2', created_by: 'rep-1' }),
]

function visibleIds(): string[] {
  return [...screen.getByTestId('board').querySelectorAll('li')].map((li) => li.textContent ?? '')
}

function renderAs(role: string) {
  mockUseClient.mockReturnValue({
    activeClient: { id: 'client-1', name: 'Demo', vertical: 'education', role },
  })
  return render(<LeadsScreen crm />)
}

beforeEach(() => {
  leadsMock.items = ROWS
  mockUseClient.mockReset()
})

describe('rep lead scope (AT-33)', () => {
  it('shows a rep the rows that resolve to them, plus the unclaimed ones', () => {
    renderAs('agent')
    expect(visibleIds().sort()).toEqual(
      ['assigned-to-me', 'created-by-me', 'mine-thread-theirs', 'nobodys', 'owned-by-me'].sort(),
    )
  })

  it('hides rows that resolve to another rep', () => {
    renderAs('agent')
    const ids = visibleIds()
    expect(ids).not.toContain('owned-by-someone-else')
    expect(ids).not.toContain('assigned-to-someone-else')
    // Created by them but owned by someone else now — owner_id wins.
    expect(ids).not.toContain('handed-over')
  })

  it.each(['manager', 'client_admin'])('leaves %s tenant-wide — the floor does not scope', (role) => {
    renderAs(role)
    expect(visibleIds()).toHaveLength(ROWS.length)
  })
})
