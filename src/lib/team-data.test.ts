import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Same recorder-builder pattern as calls-data.test.ts: the Supabase client is a
// Proxy that records every builder call and resolves a per-table response.
type Op = { fn: string; args: unknown[] }
type Recorded = { table: string; ops: Op[] }

const { calls, responses, supabaseMock } = vi.hoisted(() => {
  const calls: Recorded[] = []
  const responses = new Map<string, { data: unknown; error: unknown }>()

  function makeBuilder(rec: Recorded): unknown {
    const builder: unknown = new Proxy(
      {},
      {
        get(_t, prop: string | symbol) {
          if (prop === 'then') {
            return (resolve: (v: unknown) => unknown) =>
              resolve(responses.get(rec.table) ?? { data: null, error: null })
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

  const fromMock = vi.fn((table: string) => {
    const rec: Recorded = { table, ops: [] }
    calls.push(rec)
    return makeBuilder(rec)
  })
  return { calls, responses, supabaseMock: { from: fromMock, rpc: vi.fn() } }
})

const { hubFetchMock } = vi.hoisted(() => ({ hubFetchMock: vi.fn() }))

vi.mock('./supabase', () => ({ supabase: supabaseMock }))
vi.mock('./api', () => ({ hubFetch: hubFetchMock }))

const { useTeam, addTeamMember, disableTeamMember, mintableBy } = await import('./team-data')

function lastCall(table: string): Recorded {
  const found = [...calls].reverse().find((c) => c.table === table)
  if (!found) throw new Error(`no call recorded against "${table}"`)
  return found
}

function opArgs(rec: Recorded, fn: string): unknown[][] {
  return rec.ops.filter((o) => o.fn === fn).map((o) => o.args)
}

beforeEach(() => {
  calls.length = 0
  responses.clear()
  hubFetchMock.mockReset()
})

describe('useTeam — the roster read', () => {
  beforeEach(() => {
    responses.set('user_client_memberships', {
      data: [
        { user_id: 'u-rep', role: 'agent', disabled_at: null },
        { user_id: 'u-old', role: 'agent', disabled_at: '2026-08-01T00:00:00Z' },
        { user_id: 'u-mgr', role: 'manager', disabled_at: null },
      ],
      error: null,
    })
    responses.set('profiles', {
      data: [
        { user_id: 'u-rep', display_name: 'Asha' },
        { user_id: 'u-mgr', display_name: 'Bilal' },
        { user_id: 'u-old', display_name: 'Chen' },
      ],
      error: null,
    })
  })

  it('scopes both reads to the tenant and bounds them', async () => {
    const { result } = renderHook(() => useTeam('c-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    for (const table of ['user_client_memberships', 'profiles']) {
      const rec = lastCall(table)
      expect(opArgs(rec, 'eq')).toContainEqual(['client_id', 'c-1'])
      // An unbounded roster read is the thing AdminShell.wall.test forbids.
      expect(opArgs(rec, 'limit').length).toBeGreaterThan(0)
    }
  })

  it('joins display names and puts disabled members last', async () => {
    const { result } = renderHook(() => useTeam('c-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.items.map((m) => m.display_name)).toEqual(['Asha', 'Bilal', 'Chen'])
    expect(result.current.items[2].disabled_at).toBe('2026-08-01T00:00:00Z')
  })

  it('reads no rows at all without a workspace', async () => {
    const { result } = renderHook(() => useTeam(null))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.items).toEqual([])
    expect(calls).toHaveLength(0)
  })

  it('surfaces a denied membership read rather than showing an empty team', async () => {
    responses.set('user_client_memberships', {
      data: null,
      error: { message: 'permission denied for table user_client_memberships' },
    })
    const { result } = renderHook(() => useTeam('c-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toMatch(/permission denied/)
    expect(result.current.items).toEqual([])
  })

  it('still lists members when the profiles read comes back empty', async () => {
    responses.set('profiles', { data: [], error: null })
    const { result } = renderHook(() => useTeam('c-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.items).toHaveLength(3)
    expect(result.current.items.every((m) => m.display_name === null)).toBe(true)
  })
})

describe('addTeamMember — hub-service is the authority', () => {
  it('always names the active workspace, so a two-tenant caller is unambiguous', async () => {
    hubFetchMock.mockResolvedValue({ kind: 'ok', data: { created: true, disabled: false } })
    await addTeamMember({ clientId: 'c-1', email: 'A@X.com ', role: 'agent', displayName: 'Asha' })

    const [path, init] = hubFetchMock.mock.calls[0]
    expect(path).toBe('/api/admin/users')
    expect(JSON.parse(init.body)).toMatchObject({
      client_id: 'c-1',
      role: 'agent',
      display_name: 'Asha',
    })
  })

  // The whole point of AT-27's error rule: the operator reads hub-service's own
  // word for why the write was refused, not a paraphrase of it.
  it('returns role_above_caller verbatim', async () => {
    hubFetchMock.mockResolvedValue({ kind: 'forbidden', code: 'role_above_caller' })
    const res = await addTeamMember({
      clientId: 'c-1',
      email: 'boss@x.com',
      role: 'manager',
      displayName: 'Boss',
    })
    expect(res).toEqual({ kind: 'error', code: 'role_above_caller' })
  })

  it('falls back to the transport kind when a failure carries no code', async () => {
    hubFetchMock.mockResolvedValue({ kind: 'no_key' })
    const res = await addTeamMember({
      clientId: 'c-1',
      email: 'a@x.com',
      role: 'agent',
      displayName: 'Asha',
    })
    expect(res).toEqual({ kind: 'error', code: 'no_key' })
  })

  // Attaching an address that already has an account elsewhere is a write to a
  // third party, so it takes a second, explicit attempt — never a silent retry.
  it('reports existing_platform_user without retrying on its own', async () => {
    hubFetchMock.mockResolvedValue({ kind: 'conflict', code: 'existing_platform_user' })
    const res = await addTeamMember({
      clientId: 'c-1',
      email: 'known@x.com',
      role: 'agent',
      displayName: 'Known',
    })
    expect(res).toEqual({ kind: 'existing_platform_user' })
    expect(hubFetchMock).toHaveBeenCalledTimes(1)
    expect(JSON.parse(hubFetchMock.mock.calls[0][1].body).allow_existing_user).toBeUndefined()
  })

  it('sends allow_existing_user only once asked to', async () => {
    hubFetchMock.mockResolvedValue({ kind: 'ok', data: { created: false, disabled: false } })
    await addTeamMember({
      clientId: 'c-1',
      email: 'known@x.com',
      role: 'agent',
      displayName: 'Known',
      allowExistingUser: true,
    })
    expect(JSON.parse(hubFetchMock.mock.calls[0][1].body).allow_existing_user).toBe(true)
  })
})

describe('disableTeamMember', () => {
  it('posts to the target\'s disable path with the tenant', async () => {
    hubFetchMock.mockResolvedValue({ kind: 'ok', data: { banned: true } })
    const res = await disableTeamMember({ clientId: 'c-1', userId: 'u-rep' })

    const [path, init] = hubFetchMock.mock.calls[0]
    expect(path).toBe('/api/admin/users/u-rep/disable')
    expect(JSON.parse(init.body)).toEqual({ client_id: 'c-1' })
    expect(res).toEqual({ kind: 'ok', banned: true })
  })

  // hub-service refuses self-disable with role_above_caller; it must reach the
  // operator intact rather than becoming a generic failure.
  it('passes a refusal code straight through', async () => {
    hubFetchMock.mockResolvedValue({ kind: 'forbidden', code: 'role_above_caller' })
    const res = await disableTeamMember({ clientId: 'c-1', userId: 'me' })
    expect(res).toEqual({ kind: 'error', code: 'role_above_caller' })
  })
})

// The ladder is hub-service's (`canMint`); this mirror only decides which
// buttons are worth offering. Nobody mints their own level.
describe('mintableBy — the mint ladder, mirrored', () => {
  it('lets client_admin mint manager and agent', () => {
    expect(mintableBy('client_admin')).toEqual(['manager', 'agent'])
  })
  it('lets a manager mint only agents', () => {
    expect(mintableBy('manager')).toEqual(['agent'])
  })
  it('lets an agent mint nobody', () => {
    expect(mintableBy('agent')).toEqual([])
  })
  it('lets super_admin mint nobody through this screen', () => {
    expect(mintableBy('super_admin')).toEqual([])
  })
})
