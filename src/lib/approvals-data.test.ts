import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Recorder-builder Proxy, same as team-data.test.ts.
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

  return {
    calls,
    responses,
    supabaseMock: {
      from: vi.fn((table: string) => {
        const rec: Recorded = { table, ops: [] }
        calls.push(rec)
        return makeBuilder(rec)
      }),
      rpc: vi.fn(),
    },
  }
})

const { hubFetchMock } = vi.hoisted(() => ({ hubFetchMock: vi.fn() }))

vi.mock('./supabase', () => ({ supabase: supabaseMock }))
vi.mock('./api', () => ({ hubFetch: hubFetchMock }))

const { usePendingApprovals, approveGroup, canApproveFor, roleAtLeast } = await import(
  './approvals-data'
)

const TENANT = 'a0de0000-0000-4000-8000-000000000001'
const REP = 'rep-1'
const MANAGER = 'mgr-1'

function pendingRow(step: string, runId = 'run-1', createdAt = '2026-09-01T10:00:00Z') {
  return {
    id: `ev-pending-${step}`,
    user_id: REP,
    session_id: 'sess-1',
    run_id: runId,
    tool: 'update_lead',
    args_summary: { value: 'won' },
    result_summary: {
      kind: 'approval_pending',
      proposer_id: REP,
      session_id: 'sess-1',
      step,
      needs_role: 'manager',
    },
    created_at: createdAt,
  }
}

function approvedRow(step: string, runId = 'run-1') {
  return {
    id: `ev-approved-${step}`,
    user_id: REP,
    session_id: 'sess-1',
    run_id: runId,
    tool: 'update_lead',
    args_summary: {},
    result_summary: {
      kind: 'approved',
      approver_id: MANAGER,
      proposer_id: REP,
      step,
    },
    created_at: '2026-09-01T11:00:00Z',
  }
}

beforeEach(() => {
  calls.length = 0
  responses.clear()
  hubFetchMock.mockReset()
  supabaseMock.from.mockClear()
})

describe('canApproveFor — the ladder, mirrored for the button only', () => {
  it('lets a manager sign for a rep', () => {
    expect(canApproveFor('manager', 'agent')).toBe(true)
  })

  it('lets a manager sign for another manager, and an admin for a manager', () => {
    expect(canApproveFor('manager', 'manager')).toBe(true)
    expect(canApproveFor('client_admin', 'manager')).toBe(true)
  })

  it('refuses to sign for someone ABOVE the approver', () => {
    // The write revalidates against the PROPOSER's role, so this would let a
    // manager authorise something they cannot do themselves.
    expect(canApproveFor('manager', 'client_admin')).toBe(false)
    expect(canApproveFor('manager', 'super_admin')).toBe(false)
  })

  it('keeps a rep below the approver floor entirely', () => {
    expect(canApproveFor('agent', 'agent')).toBe(false)
    expect(roleAtLeast('agent', 'manager')).toBe(false)
    expect(roleAtLeast('manager', 'manager')).toBe(true)
  })
})

describe('usePendingApprovals — pending is a subtraction, not a column', () => {
  it('scopes and bounds the read', async () => {
    responses.set('agent_events', { data: [], error: null })
    renderHook(() => usePendingApprovals(TENANT))
    await waitFor(() => expect(calls.length).toBeGreaterThan(0))
    const rec = calls[0]
    expect(rec.table).toBe('agent_events')
    expect(rec.ops.filter((o) => o.fn === 'eq').map((o) => o.args)).toContainEqual([
      'client_id',
      TENANT,
    ])
    expect(rec.ops.some((o) => o.fn === 'limit')).toBe(true)
  })

  it('drops a step that already has an approved row for the same run', async () => {
    responses.set('agent_events', {
      data: [approvedRow('step-a'), pendingRow('step-a'), pendingRow('step-b')],
      error: null,
    })
    const { result } = renderHook(() => usePendingApprovals(TENANT))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.groups).toHaveLength(1)
    expect(result.current.groups[0].steps.map((s) => s.step)).toEqual(['step-b'])
  })

  it('keeps a step whose approval belongs to a DIFFERENT run', async () => {
    responses.set('agent_events', {
      data: [approvedRow('step-a', 'run-other'), pendingRow('step-a', 'run-1')],
      error: null,
    })
    const { result } = renderHook(() => usePendingApprovals(TENANT))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.groups[0].steps.map((s) => s.step)).toEqual(['step-a'])
  })

  it('groups a run’s steps together, because approving clears the whole plan', async () => {
    responses.set('agent_events', {
      data: [pendingRow('step-a'), pendingRow('step-b')],
      error: null,
    })
    const { result } = renderHook(() => usePendingApprovals(TENANT))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.groups).toHaveLength(1)
    expect(result.current.groups[0].steps).toHaveLength(2)
    expect(result.current.groups[0].proposerId).toBe(REP)
  })

  it('counts a re-proposed step once', async () => {
    responses.set('agent_events', {
      data: [pendingRow('step-a'), { ...pendingRow('step-a'), id: 'ev-dup' }],
      error: null,
    })
    const { result } = renderHook(() => usePendingApprovals(TENANT))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.groups[0].steps).toHaveLength(1)
  })
})

describe('approveGroup — the manager supplies authority, not reach', () => {
  const group = {
    sessionId: 'sess-1',
    runId: 'run-1',
    proposerId: REP,
    createdAt: '2026-09-01T10:00:00Z',
    steps: [
      {
        id: 'ev-1',
        sessionId: 'sess-1',
        runId: 'run-1',
        proposerId: REP,
        step: 'step-a',
        tool: 'update_lead',
        argsSummary: {},
        createdAt: '2026-09-01T10:00:00Z',
      },
      {
        id: 'ev-2',
        sessionId: 'sess-1',
        runId: 'run-1',
        proposerId: REP,
        step: 'step-b',
        tool: 'update_lead',
        argsSummary: {},
        createdAt: '2026-09-01T10:00:00Z',
      },
    ],
  }

  it('names the proposer and sends EVERY outstanding step in one call', async () => {
    hubFetchMock.mockResolvedValue({ kind: 'ok', data: { ok: true } })
    const res = await approveGroup(TENANT, group)
    expect(res).toEqual({ ok: true })
    const [path, init] = hubFetchMock.mock.calls[0]
    expect(path).toBe('/api/agent-approve')
    // Omitting proposer_id would make hub-service treat this as the manager
    // clearing their OWN checklist — a different, wrong code path.
    expect(JSON.parse(init.body)).toEqual({
      session_id: 'sess-1',
      client_id: TENANT,
      proposer_id: REP,
      approvals: [
        { id: 'step-a', tier: 'explicit' },
        { id: 'step-b', tier: 'explicit' },
      ],
    })
  })

  it('reports hub-service’s refusal code verbatim', async () => {
    hubFetchMock.mockResolvedValue({ kind: 'forbidden', code: 'self_approval' })
    expect(await approveGroup(TENANT, group)).toEqual({ ok: false, code: 'self_approval' })
  })

  it('treats a 200 with ok:false as a refusal, not a success', async () => {
    hubFetchMock.mockResolvedValue({ kind: 'ok', data: { ok: false, code: 'no_pending_plan' } })
    expect(await approveGroup(TENANT, group)).toEqual({ ok: false, code: 'no_pending_plan' })
  })
})
