import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ClientOption, Role } from './ClientProvider'

// The shells are stubbed, deliberately. RoleRouter's ONLY job is choosing which
// shell a membership role opens; rendering the real shells would drag in
// react-router, the Supabase client and every data hook, and would test those
// instead. Each stub is identifiable by text so a wrong branch is a visible
// failure rather than a silent pass.
vi.mock('./RepShell', () => ({ RepShell: () => <div>STUB RepShell</div> }))
vi.mock('./ManagerShell', () => ({ ManagerShell: () => <div>STUB ManagerShell</div> }))
vi.mock('./AdminShell', () => ({ AdminShell: () => <div>STUB AdminShell</div> }))
vi.mock('./HandoffScreen', () => ({
  // The role prop is rendered, not just accepted: test 2 asserts super_admin
  // reaches the handoff *as super_admin*, which is what keeps the Workbench
  // punt distinguishable from a client_admin regression.
  HandoffScreen: ({ role }: { role: Role }) => <div>STUB HandoffScreen role={role}</div>,
}))

const { mockUseClient } = vi.hoisted(() => ({ mockUseClient: vi.fn() }))
vi.mock('./ClientProvider', () => ({ useClient: mockUseClient }))

// Import AFTER the mocks are registered.
const { RoleRouter } = await import('./RoleRouter')

function membership(role: Role): ClientOption {
  return { id: 'c-1', name: 'Demo Academy', vertical: 'education', role }
}

function renderWith(state: {
  activeClient: ClientOption | null
  loading?: boolean
}) {
  mockUseClient.mockReturnValue({
    activeClient: state.activeClient,
    loading: state.loading ?? false,
    clients: state.activeClient ? [state.activeClient] : [],
    setActiveClientId: vi.fn(),
  })
  return render(<RoleRouter />)
}

describe('RoleRouter — the role wall', () => {
  // TEST 3 (regression guard): the two shells that already worked must not move.
  it('routes agent to RepShell', () => {
    renderWith({ activeClient: membership('agent') })
    expect(screen.getByText('STUB RepShell')).toBeInTheDocument()
  })

  it('routes manager to ManagerShell', () => {
    renderWith({ activeClient: membership('manager') })
    expect(screen.getByText('STUB ManagerShell')).toBeInTheDocument()
  })

  // TEST 1 (the new behaviour): client_admin stops hitting the Workbench punt.
  // This is what finally lets Joyal's own login into the app.
  it('routes client_admin to AdminShell, not to HandoffScreen', () => {
    renderWith({ activeClient: membership('client_admin') })
    expect(screen.getByText('STUB AdminShell')).toBeInTheDocument()
    expect(screen.queryByText(/STUB HandoffScreen/)).not.toBeInTheDocument()
  })

  // TEST 2 (regression guard): Joyal's ruling is THREE shells, not four.
  // super_admin keeps the Workbench punt. If a later session "helpfully" gives
  // super_admin a shell, this fails.
  it('routes super_admin to HandoffScreen, not to any shell', () => {
    renderWith({ activeClient: membership('super_admin') })
    expect(screen.getByText(/STUB HandoffScreen role=super_admin/)).toBeInTheDocument()
    expect(screen.queryByText(/STUB (Rep|Manager|Admin)Shell/)).not.toBeInTheDocument()
  })

  // TEST 4: neither degenerate case may fall through to a shell.
  it('renders "No workspace yet" with no membership, and no shell', () => {
    renderWith({ activeClient: null })
    expect(screen.getByText('No workspace yet')).toBeInTheDocument()
    expect(screen.queryByText(/STUB (Rep|Manager|Admin)Shell/)).not.toBeInTheDocument()
  })

  it('renders "Unknown role" for an unrecognised role, and no shell', () => {
    renderWith({ activeClient: membership('auditor' as Role) })
    expect(screen.getByText('Unknown role')).toBeInTheDocument()
    expect(screen.queryByText(/STUB (Rep|Manager|Admin)Shell/)).not.toBeInTheDocument()
  })

  it('renders a loading skeleton rather than guessing a shell', () => {
    renderWith({ activeClient: null, loading: true })
    expect(screen.queryByText('No workspace yet')).not.toBeInTheDocument()
    expect(screen.queryByText(/STUB (Rep|Manager|Admin)Shell/)).not.toBeInTheDocument()
  })
})
