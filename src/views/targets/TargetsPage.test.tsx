import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TeamMember } from '../../lib/team-data'
import type { TargetItem } from '../../lib/targets-data'

// targets-data and team-data are both already covered by their own suites; what
// is untested until here is the SCREEN's own logic — who gets a row, and what it
// is allowed to send. Those two are the whole risk surface: a row for the wrong
// person, or a NaN reaching a money column.
type UpsertResult = { ok: true } | { ok: false; message: string }

const { upsertMock, useTeamMock, useTeamTargetsMock } = vi.hoisted(() => ({
  upsertMock: vi.fn(async (): Promise<{ ok: true } | { ok: false; message: string }> => ({
    ok: true,
  })),
  useTeamMock: vi.fn(),
  useTeamTargetsMock: vi.fn(),
}))

vi.mock('../../lib/team-data', () => ({ useTeam: useTeamMock }))
vi.mock('../../lib/targets-data', async () => {
  const actual = await vi.importActual<typeof import('../../lib/targets-data')>(
    '../../lib/targets-data',
  )
  return { ...actual, useTeamTargets: useTeamTargetsMock, upsertTarget: upsertMock }
})
vi.mock('../../shell/ClientProvider', () => ({
  useClient: () => ({
    activeClient: { id: 'c-1', name: 'Demo Academy', vertical: 'education', role: 'manager' },
    clients: [],
    setActiveClientId: vi.fn(),
    loading: false,
  }),
}))
vi.mock('../../auth/AuthProvider', () => ({
  useAuth: () => ({ session: { user: { id: 'mgr-1' } }, loading: false, passwordRecovery: false }),
}))

const { TargetsPage } = await import('./TargetsPage')

const MEMBERS: TeamMember[] = [
  { user_id: 'u-admin', role: 'client_admin', display_name: 'Joyal', disabled_at: null },
  { user_id: 'u-mgr', role: 'manager', display_name: 'Bilal', disabled_at: null },
  { user_id: 'u-rep', role: 'agent', display_name: 'Asha', disabled_at: null },
  { user_id: 'u-gone', role: 'agent', display_name: 'Chen', disabled_at: '2026-08-01T00:00:00Z' },
]

function target(over: Partial<TargetItem> = {}): TargetItem {
  return {
    id: 't-1',
    client_id: 'c-1',
    user_id: 'u-rep',
    month: '2026-09-01',
    target_value: 500000,
    incentive_per_won: 2000,
    bonus_at_target: 10000,
    created_by: 'mgr-1',
    created_at: '',
    updated_at: '',
    ...over,
  }
}

beforeEach(() => {
  upsertMock.mockClear()
  upsertMock.mockResolvedValue({ ok: true } as UpsertResult)
  useTeamMock.mockReturnValue({ items: MEMBERS, loading: false, error: null, reload: vi.fn() })
  useTeamTargetsMock.mockReturnValue({ items: [], loading: false, reload: vi.fn() })
})

describe('TargetsPage — who gets a row', () => {
  // A target is a rep's number. Managers and admins carry the floor's, and a
  // disabled membership is history — neither should be given a target box.
  it('lists active reps only, not managers, admins or disabled members', () => {
    render(<TargetsPage />)
    expect(screen.getByText('Asha')).toBeInTheDocument()
    expect(screen.queryByText('Joyal')).not.toBeInTheDocument()
    expect(screen.queryByText('Bilal')).not.toBeInTheDocument()
    expect(screen.queryByText('Chen')).not.toBeInTheDocument()
  })

  it('says so when the tenant has no reps yet', () => {
    useTeamMock.mockReturnValue({
      items: [MEMBERS[0]],
      loading: false,
      error: null,
      reload: vi.fn(),
    })
    render(<TargetsPage />)
    expect(screen.getByText('No reps yet')).toBeInTheDocument()
  })

  it('seeds the boxes from the stored target', () => {
    useTeamTargetsMock.mockReturnValue({ items: [target()], loading: false, reload: vi.fn() })
    render(<TargetsPage />)
    expect(screen.getByLabelText(/Monthly target for Asha/)).toHaveValue('500000')
    expect(screen.getByLabelText(/Incentive per won for Asha/)).toHaveValue('2000')
  })
})

describe('TargetsPage — what it will send', () => {
  it('sends the typed number, defaulting the two payout fields to zero', async () => {
    const user = userEvent.setup()
    render(<TargetsPage />)
    await user.type(screen.getByLabelText(/Monthly target for Asha/), '400000')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(upsertMock).toHaveBeenCalledTimes(1))
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: 'c-1',
        userId: 'u-rep',
        targetValue: 400000,
        incentivePerWon: 0,
        bonusAtTarget: 0,
        createdBy: 'mgr-1',
      }),
    )
  })

  // The money guard. These columns are numeric and a NaN would land as a real
  // target, so the screen must refuse before the upsert, not after.
  it.each(['abc', '-5', '1e999'])('refuses to save a target of %s', async (bad) => {
    const user = userEvent.setup()
    render(<TargetsPage />)
    await user.type(screen.getByLabelText(/Monthly target for Asha/), bad)
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(upsertMock).not.toHaveBeenCalled()
  })

  it('will not save an untouched row', () => {
    useTeamTargetsMock.mockReturnValue({ items: [target()], loading: false, reload: vi.fn() })
    render(<TargetsPage />)
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('shows the database\'s refusal rather than claiming it saved', async () => {
    upsertMock.mockResolvedValue({
      ok: false,
      message: 'new row violates row-level security policy',
    } as UpsertResult)
    const user = userEvent.setup()
    render(<TargetsPage />)
    await user.type(screen.getByLabelText(/Monthly target for Asha/), '400000')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    const row = screen.getByRole('listitem')
    await waitFor(() =>
      expect(within(row).getByRole('alert')).toHaveTextContent(/row-level security/),
    )
    expect(within(row).queryByRole('button', { name: 'Saved' })).not.toBeInTheDocument()
  })
})
