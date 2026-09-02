import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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

vi.mock('./supabase', () => ({ supabase: supabaseMock }))

const { useFeatureGrants, updateFeatureGrant, featureOn, featureEffect, GRANTED_LOCK_MESSAGE } =
  await import('./featureOn')

function lastCall(table: string): Recorded {
  const found = [...calls].reverse().find((c) => c.table === table)
  if (!found) throw new Error(`no call recorded against "${table}"`)
  return found
}

function opArgs(rec: Recorded, fn: string): unknown[][] {
  return rec.ops.filter((o) => o.fn === fn).map((o) => o.args)
}

const ROWS = [
  { id: 'g-1', feature: 'agent_chat', granted: true, enabled: true, enabled_roles: ['agent', 'manager'] },
  { id: 'g-2', feature: 'agent_autopilot', granted: false, enabled: true, enabled_roles: ['manager'] },
  { id: 'g-3', feature: 'insights', granted: true, enabled: false, enabled_roles: ['agent'] },
]

beforeEach(() => {
  calls.length = 0
  responses.clear()
  responses.set('feature_grants', { data: ROWS, error: null })
})

describe('useFeatureGrants', () => {
  it('reads the tenant-wide rows only, scoped and bounded', async () => {
    const { result } = renderHook(() => useFeatureGrants('c-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    const rec = lastCall('feature_grants')
    expect(opArgs(rec, 'eq')).toContainEqual(['client_id', 'c-1'])
    // Per-user override rows are a service-role surface, not this card's.
    expect(opArgs(rec, 'is')).toContainEqual(['user_id', null])
    expect(opArgs(rec, 'limit').length).toBeGreaterThan(0)
    expect(result.current.grants).toHaveLength(3)
  })

  it('surfaces a failed read instead of showing "no features"', async () => {
    responses.set('feature_grants', { data: null, error: { message: 'permission denied' } })
    const { result } = renderHook(() => useFeatureGrants('c-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('permission denied')
    expect(result.current.grants).toEqual([])
  })
})

describe('updateFeatureGrant — what a tenant may write', () => {
  it('sends only the columns the tenant owns', async () => {
    await updateFeatureGrant('g-1', { enabled: false })
    const rec = lastCall('feature_grants')
    const [patch] = opArgs(rec, 'update')[0] as [Record<string, unknown>]
    expect(patch).toEqual({ enabled: false })
    expect(patch).not.toHaveProperty('granted')
    expect(opArgs(rec, 'eq')).toContainEqual(['id', 'g-1'])
  })

  it('writes enabled_roles as a whole array', async () => {
    await updateFeatureGrant('g-1', { enabled_roles: ['agent'] })
    const [patch] = opArgs(lastCall('feature_grants'), 'update')[0] as [Record<string, unknown>]
    expect(patch).toEqual({ enabled_roles: ['agent'] })
  })

  // AT-28 asks for a FORCED `granted` write. The card offers no control for it,
  // so the only way to attempt one is to bypass the card and call the writer
  // directly — which is what this does, with the column cast past the type.
  //
  // ⚠ What this proves and what it does not: the DB is mocked, so this asserts
  // that a rejection reaches the operator UNCHANGED, not that the trigger
  // fires. 045's `tg_feature_grants_lock_granted` is the thing that actually
  // refuses (`auth.uid() IS NOT NULL` → RAISE), and hub-service's own migration
  // tests cover that it does. The constant is shared with the module so a
  // reworded migration fails here rather than silently passing.
  it('surfaces the granted-lock trigger message verbatim when one is forced', async () => {
    responses.set('feature_grants', { data: null, error: { message: GRANTED_LOCK_MESSAGE } })
    const res = await updateFeatureGrant('g-1', { granted: true } as unknown as { enabled: boolean })
    expect(res).toEqual({ ok: false, message: GRANTED_LOCK_MESSAGE })
    expect(GRANTED_LOCK_MESSAGE).toContain('service-role only')
  })
})

describe('featureOn — cosmetic gate', () => {
  it('is on only when granted, enabled, and the role is listed', () => {
    expect(featureOn(ROWS, 'agent_chat', 'agent')).toBe(true)
    expect(featureOn(ROWS, 'agent_chat', 'client_admin')).toBe(false) // role not listed
    expect(featureOn(ROWS, 'agent_autopilot', 'manager')).toBe(false) // not granted
    expect(featureOn(ROWS, 'insights', 'agent')).toBe(false) // switched off
  })

  it('ignores the role when none is given', () => {
    expect(featureOn(ROWS, 'agent_chat')).toBe(true)
  })

  it('is off for a feature the tenant has no row for', () => {
    expect(featureOn(ROWS, 'nonexistent', 'agent')).toBe(false)
  })
})

describe('featureEffect', () => {
  it('gives a plain-language line for a known key', () => {
    expect(featureEffect('agent_chat')).toMatch(/answers customers/i)
  })
  // An unmapped key must still render its row — null means "no gloss", not
  // "hide the feature the tenant is paying for".
  it('returns null for an unmapped key rather than inventing one', () => {
    expect(featureEffect('some_new_feature')).toBeNull()
  })
})
