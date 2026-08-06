import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Same recorder-builder pattern as objections-data.test.ts (itself mirrored
// from AdminShell.wall.test.tsx / inbox-data.test.tsx): the Supabase client
// is a Proxy that records every builder call and resolves via a per-table
// response the test sets up front. `rpc` is separate — completeCall calls it
// directly (no chaining), so it's a plain vi.fn with mockResolvedValueOnce.
type Op = { fn: string; args: unknown[] }
type Recorded = { table: string; ops: Op[] }

const { calls, responses, fromMock, rpcMock, supabaseMock } = vi.hoisted(() => {
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

  const rpcMock = vi.fn()
  const supabaseMock = { from: fromMock, rpc: rpcMock }
  return { calls, responses, fromMock, rpcMock, supabaseMock }
})

vi.mock('./supabase', () => ({ supabase: supabaseMock }))

const { startCallSession, completeCall, useCallLogs } = await import('./calls-data')

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
  rpcMock.mockReset()
})

describe('startCallSession', () => {
  it('upserts on (client_id, client_request_id) — never insert — so a retried tap is safe', async () => {
    responses.set('call_sessions', { data: { id: 'session-1' }, error: null })
    const res = await startCallSession({
      clientId: 'client-1',
      contactId: 'contact-1',
      actorId: 'user-1',
      clientRequestId: 'req-abc',
    })
    expect(res).toEqual({ ok: true, id: 'session-1' })

    const rec = lastCall('call_sessions')
    expect(opArgs(rec, 'insert')).toHaveLength(0)
    const upserts = opArgs(rec, 'upsert')
    expect(upserts).toHaveLength(1)
    const [payload, opts] = upserts[0] as [Record<string, unknown>, Record<string, unknown>]
    expect(payload).toEqual({
      client_id: 'client-1',
      contact_id: 'contact-1',
      lead_id: null,
      conversation_id: null,
      actor_id: 'user-1',
      surface: null,
      requested_number: null,
      client_request_id: 'req-abc',
    })
    expect(opts).toEqual({ onConflict: 'client_id,client_request_id' })
  })

  it('a second tap with the same clientRequestId sends the identical upsert shape (retry-safe from the args alone)', async () => {
    responses.set('call_sessions', { data: { id: 'session-1' }, error: null })
    const args = {
      clientId: 'client-1',
      contactId: 'contact-1',
      actorId: 'user-1',
      clientRequestId: 'req-abc',
    }
    await startCallSession(args)
    await startCallSession(args)

    const upsertCalls = calls.filter((c) => c.table === 'call_sessions')
    expect(upsertCalls).toHaveLength(2)
    const [firstPayload, firstOpts] = opArgs(upsertCalls[0], 'upsert')[0]
    const [secondPayload, secondOpts] = opArgs(upsertCalls[1], 'upsert')[0]
    expect(secondPayload).toEqual(firstPayload)
    expect(secondOpts).toEqual(firstOpts)
  })

  it('returns the error message on a write error', async () => {
    responses.set('call_sessions', { data: null, error: { message: 'fail' } })
    const res = await startCallSession({
      clientId: 'client-1',
      contactId: 'contact-1',
      actorId: 'user-1',
      clientRequestId: 'req-abc',
    })
    expect(res).toEqual({ ok: false, message: 'fail' })
  })
})

describe('completeCall', () => {
  it('calls pm_log_call_outcome with the optional args defaulted to null when omitted', async () => {
    rpcMock.mockResolvedValueOnce({
      data: [{ call_log_id: 'cl-1', objection_log_id: null, follow_up_id: null, active_script_version_id: null }],
      error: null,
    })
    const res = await completeCall('session-1', 'closed')
    expect(rpcMock).toHaveBeenCalledWith('pm_log_call_outcome', {
      p_call_session_id: 'session-1',
      p_outcome: 'closed',
      p_taxonomy_key: null,
      p_callback_at: null,
      p_note: null,
    })
    expect(res).toEqual({
      ok: true,
      callLogId: 'cl-1',
      objectionLogId: null,
      followUpId: null,
      activeScriptVersionId: null,
    })
  })

  it('passes the optional args through when supplied, and unwraps a single-row array response', async () => {
    rpcMock.mockResolvedValueOnce({
      data: [{ call_log_id: 'cl-2', objection_log_id: 'obj-1', follow_up_id: 'fu-1', active_script_version_id: 'sv-1' }],
      error: null,
    })
    const res = await completeCall('session-1', 'callback', {
      taxonomyKey: 'price',
      callbackAt: '2026-08-10T09:00:00.000Z',
      note: 'call back next week',
    })
    expect(rpcMock).toHaveBeenCalledWith('pm_log_call_outcome', {
      p_call_session_id: 'session-1',
      p_outcome: 'callback',
      p_taxonomy_key: 'price',
      p_callback_at: '2026-08-10T09:00:00.000Z',
      p_note: 'call back next week',
    })
    expect(res).toEqual({
      ok: true,
      callLogId: 'cl-2',
      objectionLogId: 'obj-1',
      followUpId: 'fu-1',
      activeScriptVersionId: 'sv-1',
    })
  })

  it('returns ok:false with the message when the RPC errors', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: 'rpc failed' } })
    const res = await completeCall('session-1', 'closed')
    expect(res).toEqual({ ok: false, message: 'rpc failed' })
  })
})

describe('useCallLogs', () => {
  it('settles without querying when client or contact is missing', async () => {
    const { result } = renderHook(() => useCallLogs(null, 'contact-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.items).toEqual([])
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('joins actor names client-side', async () => {
    responses.set('call_logs', {
      data: [
        {
          id: 'log-1',
          call_session_id: 'session-1',
          contact_id: 'contact-1',
          lead_id: null,
          outcome: 'closed',
          objection_log_id: null,
          callback_follow_up_id: null,
          note: null,
          actor_id: 'user-1',
          occurred_at: '2026-08-01T00:00:00.000Z',
        },
      ],
      error: null,
    })
    responses.set('profiles', { data: [{ user_id: 'user-1', display_name: 'Asha' }], error: null })

    const { result } = renderHook(() => useCallLogs('client-1', 'contact-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.items).toEqual([
      {
        id: 'log-1',
        call_session_id: 'session-1',
        contact_id: 'contact-1',
        lead_id: null,
        outcome: 'closed',
        objection_log_id: null,
        callback_follow_up_id: null,
        note: null,
        actor_id: 'user-1',
        actorName: 'Asha',
        occurred_at: '2026-08-01T00:00:00.000Z',
      },
    ])
    const rec = lastCall('call_logs')
    expect(opArgs(rec, 'eq')).toContainEqual(['client_id', 'client-1'])
    expect(opArgs(rec, 'eq')).toContainEqual(['contact_id', 'contact-1'])
  })

  it('surfaces the read error instead of throwing', async () => {
    responses.set('call_logs', { data: null, error: { message: 'boom' } })
    responses.set('profiles', { data: [], error: null })
    const { result } = renderHook(() => useCallLogs('client-1', 'contact-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.items).toEqual([])
    expect(result.current.error).toBe('boom')
  })
})
