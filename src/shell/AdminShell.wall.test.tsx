import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ClientOption, Role } from './ClientProvider'

/**
 * TEST 5 — THE WALL TEST (§S5: "the single most likely defect in this line of
 * work").
 *
 * The scenario this guards against is not a bug a compiler can see. It is a
 * session shipping a shell whose mere selection widens what the browser can
 * read — a landing that reaches for an ops table, a query that drops its
 * client_id filter "because admins see everything", a fetch that adds a
 * privileged header.
 *
 * So: force the client-side role value to `client_admin` for a user whose real
 * membership is `agent`, render the admin shell, and assert that the ONLY
 * consequence is what gets painted.
 *
 * What makes this a real test and not a restatement of the code: the Supabase
 * client is a recorder. Every `.from(table)` and every builder call is captured,
 * and the assertions run against what the component actually issued at runtime.
 * A future landing that quietly adds `.from('dead_letter')` or forgets
 * `.eq('client_id', …)` fails here.
 */

const TENANT = 'a0de0000-0000-4000-8000-000000000001'
const AGENT_USER = '11111111-1111-4111-8111-111111111111'

// Tables the browser is already allowed to read under RLS. `dead_letter` and
// `llm_usage_logs` are ops tables and are deliberately absent: §S5 rules that
// wanting one is a separate src/api/ session with its own auth review, never a
// widened grant here.
const READABLE = new Set(['conversations', 'contacts', 'turn_traces', 'leads', 'lead_stages', 'follow_ups', 'messages'])

type Recorded = { table: string; ops: { fn: string; args: unknown[] }[] }

const { recorded, supabaseMock, fetchSpy } = vi.hoisted(() => {
  const recorded: { calls: Recorded[] } = { calls: [] }

  const makeBuilder = (rec: Recorded): unknown => {
    const builder: unknown = new Proxy(
      {},
      {
        get(_t, prop: string | symbol) {
          // Supabase query builders are thenables; awaiting one runs the query.
          if (prop === 'then') {
            return (resolve: (v: unknown) => unknown) => resolve({ data: [], error: null })
          }
          if (prop === 'catch' || prop === 'finally') return () => builder
          return (...args: unknown[]) => {
            rec.ops.push({ fn: String(prop), args })
            return builder
          }
        },
      },
    )
    return builder
  }

  const supabaseMock = {
    from(table: string) {
      const rec: Recorded = { table, ops: [] }
      recorded.calls.push(rec)
      return makeBuilder(rec)
    },
    channel() {
      const ch: Record<string, unknown> = {}
      ch.on = () => ch
      ch.subscribe = (cb?: (s: string) => void) => {
        cb?.('SUBSCRIBED')
        return ch
      }
      return ch
    },
    removeChannel: () => Promise.resolve('ok'),
    auth: {
      getSession: () =>
        Promise.resolve({ data: { session: { access_token: 'jwt-for-an-agent' } } }),
    },
  }

  const fetchSpy = vi.fn()
  return { recorded, supabaseMock, fetchSpy }
})

vi.mock('../lib/supabase', () => ({ supabase: supabaseMock }))

// The forced role. The membership underneath is an AGENT — that mismatch is the
// whole point of the test.
const forcedAdmin: ClientOption = {
  id: TENANT,
  name: 'Vidya Sagar Academy (Demo)',
  vertical: 'education',
  role: 'client_admin' as Role,
}

vi.mock('./ClientProvider', () => ({
  useClient: () => ({
    activeClient: forcedAdmin,
    clients: [forcedAdmin],
    setActiveClientId: () => {},
    loading: false,
  }),
}))

vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({
    session: { user: { id: AGENT_USER }, access_token: 'jwt-for-an-agent' },
    signOut: () => {},
  }),
}))

const { AdminShell } = await import('./AdminShell')

describe('AdminShell — forcing the client-side role grants nothing', () => {
  beforeEach(() => {
    recorded.calls = []
    fetchSpy.mockReset()
    vi.stubGlobal('fetch', fetchSpy)
  })

  it('renders the admin landing when the role value is forced', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AdminShell />
      </MemoryRouter>,
    )
    // Proves the forced value did change what is painted — otherwise the
    // assertions below would pass vacuously against a blank screen.
    expect(await screen.findByText(/Health/i)).toBeInTheDocument()
  })

  it('reads only tables the browser may already read under RLS', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AdminShell />
      </MemoryRouter>,
    )
    await waitFor(() => expect(recorded.calls.length).toBeGreaterThan(0))

    const tables = [...new Set(recorded.calls.map((c) => c.table))]
    for (const t of tables) expect(READABLE).toContain(t)
    // Named explicitly so the failure message is useful, and so adding an ops
    // table is a loud failure rather than a quiet allowlist edit.
    expect(tables).not.toContain('dead_letter')
    expect(tables).not.toContain('llm_usage_logs')
  })

  it('scopes every read to the same tenant with an explicit client_id filter', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AdminShell />
      </MemoryRouter>,
    )
    await waitFor(() => expect(recorded.calls.length).toBeGreaterThan(0))

    for (const call of recorded.calls) {
      const clientIdFilters = call.ops.filter(
        (o) => o.fn === 'eq' && o.args[0] === 'client_id',
      )
      expect(
        clientIdFilters.length,
        `read from "${call.table}" carried no explicit client_id filter`,
      ).toBeGreaterThan(0)
      for (const f of clientIdFilters) expect(f.args[1]).toBe(TENANT)
    }
  })

  it('bounds every read — no unbounded list', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AdminShell />
      </MemoryRouter>,
    )
    await waitFor(() => expect(recorded.calls.length).toBeGreaterThan(0))

    for (const call of recorded.calls) {
      const limits = call.ops.filter((o) => o.fn === 'limit' || o.fn === 'range')
      expect(limits.length, `read from "${call.table}" was unbounded`).toBeGreaterThan(0)
    }
  })

  it('gains no API capability — the landing calls hub-service not at all', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AdminShell />
      </MemoryRouter>,
    )
    await waitFor(() => expect(recorded.calls.length).toBeGreaterThan(0))
    // A forced role cannot reach hub-service through a screen that never calls
    // it. Where the app DOES call hub-service (agent-send), authority is
    // re-derived server-side from the JWT and user_client_memberships on every
    // request — this browser-side value is not an input to that decision.
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
