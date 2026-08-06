import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Recorder-builder pattern, mirrored from AdminShell.wall.test.tsx and
// inbox-data.test.tsx: the Supabase client is a Proxy that records every
// builder call (table + fn + args) and resolves via a per-table response the
// test sets up front. This lets us assert the EXACT shape sent to
// .insert()/.update() — not just that a query ran.
type Op = { fn: string; args: unknown[] }
type Recorded = { table: string; ops: Op[] }

const { calls, responses, fromMock, supabaseMock } = vi.hoisted(() => {
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

  const supabaseMock = { from: fromMock }
  return { calls, responses, fromMock, supabaseMock }
})

vi.mock('./supabase', () => ({ supabase: supabaseMock }))

const { useObjectionTaxonomy, useObjectionLogs, logObjection, undoObjection, saveNote } =
  await import('./objections-data')

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
})

describe('useObjectionTaxonomy', () => {
  it('settles without querying when there is no active client', async () => {
    const { result } = renderHook(() => useObjectionTaxonomy(null))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.items).toEqual([])
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('loads active taxonomy scoped to the client', async () => {
    responses.set('objection_taxonomy', {
      data: [{ id: 't1', key: 'price', label: 'Price', aliases: ['too expensive'] }],
      error: null,
    })
    const { result } = renderHook(() => useObjectionTaxonomy('client-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.items).toEqual([{ id: 't1', key: 'price', label: 'Price', aliases: ['too expensive'] }])
    const rec = lastCall('objection_taxonomy')
    expect(opArgs(rec, 'eq')).toContainEqual(['client_id', 'client-1'])
    expect(opArgs(rec, 'eq')).toContainEqual(['status', 'active'])
  })
})

describe('useObjectionLogs', () => {
  it('settles without querying when client or contact is missing', async () => {
    const { result } = renderHook(() => useObjectionLogs('client-1', null))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.items).toEqual([])
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('joins actor names client-side and reads resolved/undone state', async () => {
    responses.set('objection_logs', {
      data: [
        {
          id: 'log-1',
          contact_id: 'contact-1',
          conversation_id: null,
          lead_id: null,
          taxonomy_id: 'tax-1',
          source: 'chat',
          note: null,
          actor_id: 'user-1',
          occurred_at: '2026-08-01T00:00:00.000Z',
          resolved_at: '2026-08-02T00:00:00.000Z',
          objection_taxonomy: { key: 'price', label: 'Price' },
        },
      ],
      error: null,
    })
    responses.set('profiles', { data: [{ user_id: 'user-1', display_name: 'Asha' }], error: null })

    const { result } = renderHook(() => useObjectionLogs('client-1', 'contact-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.items).toEqual([
      {
        id: 'log-1',
        contact_id: 'contact-1',
        conversation_id: null,
        lead_id: null,
        taxonomy_id: 'tax-1',
        taxonomyKey: 'price',
        taxonomyLabel: 'Price',
        source: 'chat',
        note: null,
        actor_id: 'user-1',
        actorName: 'Asha',
        occurred_at: '2026-08-01T00:00:00.000Z',
        resolved: true,
      },
    ])
    const rec = lastCall('objection_logs')
    expect(opArgs(rec, 'eq')).toContainEqual(['client_id', 'client-1'])
    expect(opArgs(rec, 'eq')).toContainEqual(['contact_id', 'contact-1'])
    expect(opArgs(rec, 'is')).toContainEqual(['undone_at', null])
  })

  it('surfaces the read error instead of throwing', async () => {
    responses.set('objection_logs', { data: null, error: { message: 'boom' } })
    responses.set('profiles', { data: [], error: null })
    const { result } = renderHook(() => useObjectionLogs('client-1', 'contact-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.items).toEqual([])
    expect(result.current.error).toBe('boom')
  })
})

describe('logObjection', () => {
  it('sends the exact insert shape, defaulting omitted optionals to null', async () => {
    responses.set('objection_logs', { data: { id: 'log-9' }, error: null })
    const res = await logObjection({
      clientId: 'client-1',
      contactId: 'contact-1',
      taxonomyId: 'tax-1',
      source: 'crm',
      actorId: 'user-1',
    })
    expect(res).toEqual({ ok: true, id: 'log-9' })
    const rec = lastCall('objection_logs')
    expect(opArgs(rec, 'insert')).toEqual([
      [
        {
          client_id: 'client-1',
          contact_id: 'contact-1',
          conversation_id: null,
          lead_id: null,
          taxonomy_id: 'tax-1',
          source: 'crm',
          note: null,
          actor_id: 'user-1',
        },
      ],
    ])
  })

  it('passes conversationId/leadId/note through when supplied', async () => {
    responses.set('objection_logs', { data: { id: 'log-10' }, error: null })
    await logObjection({
      clientId: 'client-1',
      contactId: 'contact-1',
      conversationId: 'conv-1',
      leadId: 'lead-1',
      taxonomyId: 'tax-1',
      source: 'call',
      note: 'too expensive',
      actorId: 'user-1',
    })
    const rec = lastCall('objection_logs')
    const [insertArg] = opArgs(rec, 'insert')[0] as [Record<string, unknown>]
    expect(insertArg.conversation_id).toBe('conv-1')
    expect(insertArg.lead_id).toBe('lead-1')
    expect(insertArg.note).toBe('too expensive')
  })

  it('returns ok:false with the message on an insert error', async () => {
    responses.set('objection_logs', { data: null, error: { message: 'insert failed' } })
    const res = await logObjection({
      clientId: 'client-1',
      contactId: 'contact-1',
      taxonomyId: 'tax-1',
      source: 'crm',
      actorId: 'user-1',
    })
    expect(res).toEqual({ ok: false, message: 'insert failed' })
  })
})

describe('undoObjection', () => {
  it('sets undone_at and undone_by, scoped by client_id and id — never deletes', async () => {
    responses.set('objection_logs', { data: [{ id: 'log-1' }], error: null })
    const res = await undoObjection('client-1', 'log-1', 'user-9')
    expect(res).toEqual({ ok: true })
    const rec = lastCall('objection_logs')
    const updateCalls = opArgs(rec, 'update')
    expect(updateCalls).toHaveLength(1)
    const [updateArg] = updateCalls[0] as [Record<string, unknown>]
    expect(updateArg.undone_by).toBe('user-9')
    expect(typeof updateArg.undone_at).toBe('string')
    expect(new Date(updateArg.undone_at as string).toString()).not.toBe('Invalid Date')
    expect(opArgs(rec, 'eq')).toContainEqual(['client_id', 'client-1'])
    expect(opArgs(rec, 'eq')).toContainEqual(['id', 'log-1'])
  })

  it('returns denied when no row is affected (RLS filtered it out)', async () => {
    responses.set('objection_logs', { data: [], error: null })
    const res = await undoObjection('client-1', 'log-1', 'user-9')
    expect(res).toEqual({ ok: false, reason: 'denied' })
  })

  it('returns the error message on a write error', async () => {
    responses.set('objection_logs', { data: null, error: { message: 'nope' } })
    const res = await undoObjection('client-1', 'log-1', 'user-9')
    expect(res).toEqual({ ok: false, reason: 'error', message: 'nope' })
  })
})

describe('saveNote', () => {
  it('updates the note, scoped by client_id and id', async () => {
    responses.set('objection_logs', { data: [{ id: 'log-1' }], error: null })
    const res = await saveNote('client-1', 'log-1', 'new note')
    expect(res).toEqual({ ok: true })
    const rec = lastCall('objection_logs')
    expect(opArgs(rec, 'update')).toEqual([[{ note: 'new note' }]])
    expect(opArgs(rec, 'eq')).toContainEqual(['client_id', 'client-1'])
    expect(opArgs(rec, 'eq')).toContainEqual(['id', 'log-1'])
  })

  it('returns denied when no row is affected', async () => {
    responses.set('objection_logs', { data: [], error: null })
    const res = await saveNote('client-1', 'log-1', 'new note')
    expect(res).toEqual({ ok: false, reason: 'denied' })
  })
})
