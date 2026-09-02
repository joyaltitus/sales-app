import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
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

// AT-26: RoleRouter now renders URL routes, so it needs a Router ancestor. The
// default entry is "/" — the address a login lands on — which is exactly the
// case the pre-AT-26 assertions below were already written against: each role
// still has to end up in its own shell without being told a path.
function renderWith(state: {
  activeClient: ClientOption | null
  loading?: boolean
  path?: string
}) {
  mockUseClient.mockReturnValue({
    activeClient: state.activeClient,
    loading: state.loading ?? false,
    clients: state.activeClient ? [state.activeClient] : [],
    setActiveClientId: vi.fn(),
  })
  return render(
    <MemoryRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      initialEntries={[state.path ?? '/']}
    >
      <RoleRouter />
    </MemoryRouter>,
  )
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

// AT-26 — three entry routes. One test per route for the role that owns it,
// and one per route for a role that does not.
//
// ⚠ These assert ROUTING, not authority. A rep who types /admin is redirected
// here, but the reason a rep cannot administer anything is RLS and hub-service
// re-deriving the role from the JWT — never this redirect. AdminShell.wall.test
// is the file that proves the wall; this one only proves the address.
describe('RoleRouter — three entry routes (AT-26)', () => {
  const OWN: Array<[Role, string, string]> = [
    ['client_admin', '/admin', 'STUB AdminShell'],
    ['manager', '/manage', 'STUB ManagerShell'],
    ['agent', '/rep', 'STUB RepShell'],
  ]

  it.each(OWN)('%s opens its own shell at %s', (role, path, stub) => {
    renderWith({ activeClient: membership(role), path })
    expect(screen.getByText(stub)).toBeInTheDocument()
  })

  it.each(OWN)('%s landing on "/" is routed to its own shell', (role, _path, stub) => {
    renderWith({ activeClient: membership(role), path: '/' })
    expect(screen.getByText(stub)).toBeInTheDocument()
  })

  // The mismatch cases: every role, at every route it does not own, lands back
  // in its own shell and never paints someone else's.
  const MISMATCH: Array<[Role, string, string, RegExp]> = [
    ['agent', '/admin', 'STUB RepShell', /STUB (Admin|Manager)Shell/],
    ['agent', '/manage', 'STUB RepShell', /STUB (Admin|Manager)Shell/],
    ['manager', '/admin', 'STUB ManagerShell', /STUB (Admin|Rep)Shell/],
    ['manager', '/rep', 'STUB ManagerShell', /STUB (Admin|Rep)Shell/],
    ['client_admin', '/manage', 'STUB AdminShell', /STUB (Manager|Rep)Shell/],
    ['client_admin', '/rep', 'STUB AdminShell', /STUB (Manager|Rep)Shell/],
  ]

  it.each(MISMATCH)('%s at %s is redirected to its own shell', (role, path, own, forbidden) => {
    renderWith({ activeClient: membership(role), path })
    expect(screen.getByText(own)).toBeInTheDocument()
    expect(screen.queryByText(forbidden)).not.toBeInTheDocument()
  })

  // super_admin keeps the Workbench punt at a shell route too — the ruling is
  // three shells, and /admin does not quietly become the fourth.
  it('super_admin gets the handoff even at /admin, not AdminShell', () => {
    renderWith({ activeClient: membership('super_admin'), path: '/admin' })
    expect(screen.getByText(/STUB HandoffScreen role=super_admin/)).toBeInTheDocument()
    expect(screen.queryByText(/STUB (Rep|Manager|Admin)Shell/)).not.toBeInTheDocument()
  })

  // An unknown path is not a 404: a signed-in user always has one home.
  it('sends an unknown path to the caller\'s own shell', () => {
    renderWith({ activeClient: membership('manager'), path: '/nope/deep' })
    expect(screen.getByText('STUB ManagerShell')).toBeInTheDocument()
  })
})
