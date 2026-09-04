import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ApprovalGroup } from '../../lib/approvals-data'

// Rendered through the `preview` prop, so no session, no network and no
// Supabase — the same door the /preview gallery uses. What is under test is the
// TWO ceremony rules, which are rendering decisions here and enforced for real
// by hub-service on every request.
vi.mock('../../lib/approvals-data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/approvals-data')>()
  return { ...actual, usePendingApprovals: () => ({ groups: [], loading: false, error: null, reload: vi.fn() }) }
})
vi.mock('../../lib/team-data', () => ({ useTeam: () => ({ items: [], loading: false, error: null, reload: vi.fn() }) }))

const { ApprovalsView } = await import('./ApprovalsView')

const GROUP: ApprovalGroup = {
  sessionId: 'sess-1',
  runId: 'run-1',
  proposerId: 'rep-1',
  createdAt: '2026-09-02T11:20:00Z',
  steps: [
    {
      id: 'ev-1',
      sessionId: 'sess-1',
      runId: 'run-1',
      proposerId: 'rep-1',
      step: 'step-a',
      tool: 'update_lead',
      argsSummary: { value: 'won' },
      createdAt: '2026-09-02T11:20:00Z',
    },
  ],
}

const MEMBERS = [
  { user_id: 'rep-1', display_name: 'Asha Menon', role: 'agent' as const, disabled_at: null },
  { user_id: 'mgr-1', display_name: 'Bilal Ahmed', role: 'manager' as const, disabled_at: null },
  { user_id: 'adm-1', display_name: 'Joyal Titus', role: 'client_admin' as const, disabled_at: null },
]

describe('ApprovalsView — nobody clears their own', () => {
  it('offers a manager the button on a rep’s proposal', () => {
    render(
      <ApprovalsView
        designData={{ groups: [GROUP], viewerId: 'mgr-1', viewerRole: 'manager', members: MEMBERS }}
      />,
    )
    expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument()
    expect(screen.queryByText(/awaiting manager/i)).not.toBeInTheDocument()
  })

  it('shows the proposer “awaiting manager”, never a button', () => {
    render(
      <ApprovalsView
        designData={{ groups: [GROUP], viewerId: 'rep-1', viewerRole: 'agent', members: MEMBERS }}
      />,
    )
    expect(screen.getByText(/awaiting manager/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument()
  })

  it('does not offer a manager the button on an ADMIN’s proposal', () => {
    // The write revalidates against the proposer's role, so this would let a
    // manager authorise an action they cannot perform themselves.
    render(
      <ApprovalsView
        designData={{
          groups: [{ ...GROUP, proposerId: 'adm-1', steps: [{ ...GROUP.steps[0], proposerId: 'adm-1' }] }],
          viewerId: 'mgr-1',
          viewerRole: 'manager',
          members: MEMBERS,
        }}
      />,
    )
    expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument()
    expect(screen.getByText(/at or above/i)).toBeInTheDocument()
  })

  it('shows the approver what they are signing for', () => {
    render(
      <ApprovalsView
        designData={{ groups: [GROUP], viewerId: 'mgr-1', viewerRole: 'manager', members: MEMBERS }}
      />,
    )
    expect(screen.getByText('update_lead')).toBeInTheDocument()
    expect(screen.getByText('won')).toBeInTheDocument()
    expect(screen.getByText('Asha Menon')).toBeInTheDocument()
  })
})
