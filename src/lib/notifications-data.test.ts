import { beforeEach, describe, expect, it, vi } from 'vitest'

// Same recorder-Proxy harness as calls-data.test.ts. What matters here is the
// SHAPE of the writes the S11 surfaces perform: the rail must only ever mark a
// notification read, and a snoozed follow-up must move `due_at` (not just
// `snoozed_until`), or the nudge engine keeps it permanently due.
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

const { markNotificationsRead, readNewLeadNotifications, shortAge } = await import('./notifications-data')
const { snoozeFollowUp, completeFollowUp, readDueFollowUps } = await import('./leads-data')

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

describe('markNotificationsRead', () => {
  it('only ever sets read_at, and only on rows still unread', async () => {
    await markNotificationsRead(['n-1', 'n-2'])
    const rec = lastCall('notifications')
    const [payload] = opArgs(rec, 'update')[0] as [Record<string, unknown>]
    expect(Object.keys(payload)).toEqual(['read_at'])
    expect(opArgs(rec, 'in')[0]).toEqual(['id', ['n-1', 'n-2']])
    expect(opArgs(rec, 'is')[0]).toEqual(['read_at', null])
  })

  it('does not touch the network for an empty batch', async () => {
    await markNotificationsRead([])
    expect(calls).toHaveLength(0)
  })
})

describe('extension alarm reads', () => {
  it('scopes due follow-ups to the authenticated memberships and alarm window', async () => {
    responses.set('follow_ups', { data: [{ id: 'fu-1', note: 'Call', due_at: '2026-08-26T10:01:00Z' }], error: null })
    await expect(readDueFollowUps(['client-a', 'client-b'], '2026-08-26T10:01:00Z')).resolves.toHaveLength(1)
    const rec = lastCall('follow_ups')
    expect(opArgs(rec, 'in')).toContainEqual(['client_id', ['client-a', 'client-b']])
    expect(opArgs(rec, 'lte')).toEqual([['due_at', '2026-08-26T10:01:00Z']])
  })

  it('reads only unread new-lead notifications inside those memberships', async () => {
    responses.set('notifications', { data: [], error: null })
    await readNewLeadNotifications(['client-a'])
    const rec = lastCall('notifications')
    expect(opArgs(rec, 'in')).toContainEqual(['client_id', ['client-a']])
    expect(opArgs(rec, 'eq')).toContainEqual(['kind', 'labeled_to_you'])
    expect(opArgs(rec, 'is')).toContainEqual(['read_at', null])
  })
})

describe('Today priority-stack actions', () => {
  it('done settles the row: status done + completed_at, scoped by client', async () => {
    responses.set('follow_ups', { data: [{ id: 'fu-1' }], error: null })
    await expect(completeFollowUp('client-1', 'fu-1')).resolves.toEqual({ ok: true })
    const rec = lastCall('follow_ups')
    const [payload] = opArgs(rec, 'update')[0] as [Record<string, string>]
    expect(payload.status).toBe('done')
    expect(payload.completed_at).toBeTruthy()
    expect(opArgs(rec, 'eq')).toEqual([
      ['client_id', 'client-1'],
      ['id', 'fu-1'],
    ])
  })

  it('snooze moves due_at with snoozed_until — a snooze the ranking and the nudge engine see', async () => {
    responses.set('follow_ups', { data: [{ id: 'fu-1' }], error: null })
    const res = await snoozeFollowUp('client-1', 'fu-1', 3)
    expect(res.ok).toBe(true)
    const [payload] = opArgs(lastCall('follow_ups'), 'update')[0] as [Record<string, string>]
    expect(payload.status).toBe('snoozed')
    expect(payload.due_at).toBe(payload.snoozed_until)
    const pushedBy = new Date(payload.due_at).getTime() - Date.now()
    expect(pushedBy).toBeGreaterThan(2.9 * 60 * 60 * 1000)
    expect(pushedBy).toBeLessThan(3.1 * 60 * 60 * 1000)
  })

  it('an RLS-filtered write reports denied rather than success', async () => {
    responses.set('follow_ups', { data: [], error: null })
    await expect(completeFollowUp('client-1', 'fu-1')).resolves.toEqual({ ok: false, reason: 'denied' })
  })
})

describe('shortAge', () => {
  const now = new Date('2026-08-07T12:00:00Z').getTime()
  const ago = (ms: number) => new Date(now - ms).toISOString()

  it('reads Now under a minute, then minutes, hours, days', () => {
    expect(shortAge(ago(30_000), now)).toBe('Now')
    expect(shortAge(ago(18 * 60_000), now)).toBe('18m')
    expect(shortAge(ago(3 * 3_600_000), now)).toBe('3h')
    expect(shortAge(ago(2 * 24 * 3_600_000), now)).toBe('2d')
  })

  it('never renders a negative age from a clock skew', () => {
    expect(shortAge(new Date(now + 60_000).toISOString(), now)).toBe('Now')
  })
})
