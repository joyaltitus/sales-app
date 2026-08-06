import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Same recorder-builder pattern as objections-data.test.ts / calls-data.test.ts.
//
// Scope note: scripts-data.ts is being concurrently EXTENDED on this branch by
// another worker (createDraftVersion, promoteScriptVersion, useScriptLibrary,
// taxonomy CRUD, etc. for Playbook.tsx). This file tests ONLY the four
// functions that existed at the start of this task: useActiveScript,
// insertScriptUsage, updateScriptUsageFeedback, insertPlaybookGap.
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

const { useActiveScript, insertScriptUsage, updateScriptUsageFeedback, insertPlaybookGap } =
  await import('./scripts-data')

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

describe('useActiveScript', () => {
  it('settles to null without querying when client or taxonomy is missing', async () => {
    const { result } = renderHook(() => useActiveScript(null, 'tax-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.script).toBeNull()
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('resolves to the standard version over a higher-version testing row, fallback:false', async () => {
    responses.set('script_versions', {
      data: [
        { id: 'v-testing-3', script_id: 's-1', version: 3, status: 'testing', headline: 'T', body: { paragraphs: [] } },
        { id: 'v-standard-2', script_id: 's-1', version: 2, status: 'standard', headline: 'S', body: { paragraphs: [{ before: 'x' }] } },
      ],
      error: null,
    })
    const { result } = renderHook(() => useActiveScript('client-1', 'tax-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.script).toEqual({
      scriptId: 's-1',
      versionId: 'v-standard-2',
      version: 2,
      status: 'standard',
      headline: 'S',
      paragraphs: [{ before: 'x' }],
      fallback: false,
    })
    const rec = lastCall('script_versions')
    expect(opArgs(rec, 'eq')).toContainEqual(['client_id', 'client-1'])
    expect(opArgs(rec, 'eq')).toContainEqual(['scripts.taxonomy_id', 'tax-1'])
    expect(opArgs(rec, 'in')).toContainEqual(['status', ['standard', 'testing']])
  })

  it('falls back to the highest-version testing row when no standard exists, fallback:true', async () => {
    // Rows arrive in the order the real query would deliver them
    // (.order('version', { ascending: false })) — highest version first.
    responses.set('script_versions', {
      data: [
        { id: 'v-testing-4', script_id: 's-1', version: 4, status: 'testing', headline: 'T4', body: { paragraphs: [] } },
        { id: 'v-testing-1', script_id: 's-1', version: 1, status: 'testing', headline: 'T1', body: { paragraphs: [] } },
      ],
      error: null,
    })
    const { result } = renderHook(() => useActiveScript('client-1', 'tax-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.script?.versionId).toBe('v-testing-4')
    expect(result.current.script?.status).toBe('testing')
    expect(result.current.script?.fallback).toBe(true)
  })

  it('resolves to null when neither a standard nor a testing version exists — a real gap', async () => {
    responses.set('script_versions', { data: [], error: null })
    const { result } = renderHook(() => useActiveScript('client-1', 'tax-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.script).toBeNull()
  })

  it('resolves to null on a read error rather than throwing', async () => {
    responses.set('script_versions', { data: null, error: { message: 'boom' } })
    const { result } = renderHook(() => useActiveScript('client-1', 'tax-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.script).toBeNull()
  })
})

describe('insertScriptUsage', () => {
  it('inserts with insertedAsDraft defaulting true and optionals defaulting to null', async () => {
    responses.set('script_usage', { data: { id: 'usage-1' }, error: null })
    const res = await insertScriptUsage({ clientId: 'client-1', scriptVersionId: 'v-1', actorId: 'user-1' })
    expect(res).toEqual({ ok: true, id: 'usage-1' })
    const rec = lastCall('script_usage')
    expect(opArgs(rec, 'insert')).toEqual([
      [
        {
          client_id: 'client-1',
          script_version_id: 'v-1',
          objection_log_id: null,
          conversation_id: null,
          actor_id: 'user-1',
          inserted_as_draft: true,
        },
      ],
    ])
  })

  it('passes objectionLogId/conversationId/insertedAsDraft through when supplied', async () => {
    responses.set('script_usage', { data: { id: 'usage-2' }, error: null })
    await insertScriptUsage({
      clientId: 'client-1',
      scriptVersionId: 'v-1',
      objectionLogId: 'log-1',
      conversationId: 'conv-1',
      actorId: 'user-1',
      insertedAsDraft: false,
    })
    const rec = lastCall('script_usage')
    const [insertArg] = opArgs(rec, 'insert')[0] as [Record<string, unknown>]
    expect(insertArg.objection_log_id).toBe('log-1')
    expect(insertArg.conversation_id).toBe('conv-1')
    expect(insertArg.inserted_as_draft).toBe(false)
  })

  it('returns ok:false with the message on an insert error', async () => {
    responses.set('script_usage', { data: null, error: { message: 'fail' } })
    const res = await insertScriptUsage({ clientId: 'client-1', scriptVersionId: 'v-1', actorId: 'user-1' })
    expect(res).toEqual({ ok: false, message: 'fail' })
  })
})

describe('updateScriptUsageFeedback', () => {
  it('updates feedback and feedback_at, scoped by client_id and id', async () => {
    responses.set('script_usage', { data: [{ id: 'usage-1' }], error: null })
    const res = await updateScriptUsageFeedback('client-1', 'usage-1', 'worked')
    expect(res).toEqual({ ok: true })
    const rec = lastCall('script_usage')
    const [updateArg] = opArgs(rec, 'update')[0] as [Record<string, unknown>]
    expect(updateArg.feedback).toBe('worked')
    expect(typeof updateArg.feedback_at).toBe('string')
    expect(opArgs(rec, 'eq')).toContainEqual(['client_id', 'client-1'])
    expect(opArgs(rec, 'eq')).toContainEqual(['id', 'usage-1'])
  })

  it('returns denied when no row is updated — actor-own only, no manager override', async () => {
    responses.set('script_usage', { data: [], error: null })
    const res = await updateScriptUsageFeedback('client-1', 'usage-1', 'didnt_work')
    expect(res).toEqual({ ok: false, reason: 'denied' })
  })

  it('returns the error message on a write error', async () => {
    responses.set('script_usage', { data: null, error: { message: 'nope' } })
    const res = await updateScriptUsageFeedback('client-1', 'usage-1', 'worked')
    expect(res).toEqual({ ok: false, reason: 'error', message: 'nope' })
  })
})

describe('insertPlaybookGap', () => {
  it('treats a duplicate-open-gap conflict (23505) as success', async () => {
    responses.set('playbook_gaps', { data: null, error: { code: '23505', message: 'duplicate' } })
    const res = await insertPlaybookGap({ clientId: 'client-1', taxonomyId: 'tax-1', createdBy: 'user-1' })
    expect(res).toEqual({ ok: true })
  })

  it('returns ok:false with the message for any other error code', async () => {
    responses.set('playbook_gaps', { data: null, error: { code: '23503', message: 'fk violation' } })
    const res = await insertPlaybookGap({ clientId: 'client-1', taxonomyId: 'tax-1', createdBy: 'user-1' })
    expect(res).toEqual({ ok: false, message: 'fk violation' })
  })

  it('inserts the exact shape when there is no conflict', async () => {
    responses.set('playbook_gaps', { data: null, error: null })
    const res = await insertPlaybookGap({
      clientId: 'client-1',
      taxonomyId: 'tax-1',
      objectionLogId: 'log-1',
      exactCustomerWords: 'too expensive',
      createdBy: 'user-1',
    })
    expect(res).toEqual({ ok: true })
    const rec = lastCall('playbook_gaps')
    expect(opArgs(rec, 'insert')).toEqual([
      [
        {
          client_id: 'client-1',
          taxonomy_id: 'tax-1',
          objection_log_id: 'log-1',
          exact_customer_words: 'too expensive',
          created_by: 'user-1',
        },
      ],
    ])
  })
})
