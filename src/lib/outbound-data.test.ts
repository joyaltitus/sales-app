import { beforeEach, describe, expect, it, vi } from 'vitest'

// Same recorder-builder Proxy as manage-data.test.ts: the client records every
// builder call, so the assertions run against what the module ISSUED rather
// than against a restatement of its source. That matters more here than
// anywhere else in the app — hub-service's two outreach lanes select rows by
// the exact shape of `meta` and `sequence_key`, so a shape drift is not a
// failed write, it is a row that sits pending forever in a lane that never
// looks at it.
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
    },
  }
})

vi.mock('./supabase', () => ({ supabase: supabaseMock }))

const { createBroadcast, sendTemplateNow, stopBroadcast, resolveSegment, estimateCost, sendable } =
  await import('./outbound-data')
import type { SegmentLead, WaTemplate } from './outbound-data'
import { EMPTY_FILTERS } from './outbound-data'

const TENANT = 'a0de0000-0000-4000-8000-000000000001'
const USER = '11111111-1111-4111-8111-111111111111'
const BROADCAST = 'bbbbbbbb-0000-4000-8000-000000000001'

const TEMPLATE: WaTemplate = {
  id: 'tttttttt-0000-4000-8000-000000000001',
  template_name: 'batch_nudge',
  language: 'en',
  category: 'marketing',
  body_preview: 'Hi {{1}}, seats are open.',
  variables: ['name'],
  meta_status: 'approved',
  active: true,
}

function callsTo(table: string): Recorded[] {
  return calls.filter((c) => c.table === table)
}

function firstArg(rec: Recorded, fn: string): unknown {
  const op = rec.ops.find((o) => o.fn === fn)
  if (!op) throw new Error(`no .${fn}() recorded on "${rec.table}"`)
  return op.args[0]
}

function contact(over: Partial<NonNullable<SegmentLead['contact']>> = {}) {
  return {
    id: 'c1',
    profile_name: 'Asha',
    external_id: '919000000001',
    channel: 'whatsapp',
    is_opted_out: false,
    ...over,
  }
}

function lead(over: Partial<SegmentLead> = {}): SegmentLead {
  return {
    stage_id: 's1',
    status: 'open',
    source: 'manual',
    campaign_id: null,
    est_value: 1000,
    contact: contact(),
    ...over,
  }
}

beforeEach(() => {
  calls.length = 0
  responses.clear()
})

describe('resolveSegment', () => {
  it('collapses a contact with several leads to one recipient', () => {
    const { recipients } = resolveSegment([lead(), lead({ status: 'won' })], EMPTY_FILTERS)
    expect(recipients).toEqual([{ id: 'c1', name: 'Asha' }])
  })

  it('excludes opted-out contacts and surfaces Instagram ones instead of dropping them', () => {
    const { recipients, igExcluded } = resolveSegment(
      [
        lead(),
        lead({ contact: contact({ id: 'c2', profile_name: 'Ravi', is_opted_out: true }) }),
        lead({ contact: contact({ id: 'c3', profile_name: 'Meera', channel: 'instagram' }) }),
      ],
      EMPTY_FILTERS,
    )
    expect(recipients.map((r) => r.id)).toEqual(['c1'])
    expect(igExcluded).toEqual(['Meera'])
  })

  it('applies the value range and the name search', () => {
    const leads = [
      lead(),
      lead({ est_value: 50, contact: contact({ id: 'c2', profile_name: 'Ravi' }) }),
    ]
    expect(resolveSegment(leads, { ...EMPTY_FILTERS, minv: '500' }).recipients.map((r) => r.id))
      .toEqual(['c1'])
    expect(resolveSegment(leads, { ...EMPTY_FILTERS, q: 'ravi' }).recipients.map((r) => r.id))
      .toEqual(['c2'])
  })
})

describe('template gates', () => {
  it('only an approved AND active template is sendable', () => {
    expect(sendable(TEMPLATE)).toBe(true)
    expect(sendable({ ...TEMPLATE, active: false })).toBe(false)
    expect(sendable({ ...TEMPLATE, meta_status: 'pending' })).toBe(false)
  })

  it('costs a marketing blast by category', () => {
    expect(estimateCost('marketing', 4)).toBeCloseTo(3.8)
    expect(estimateCost('utility', 4)).toBeCloseTo(1.4)
  })
})

describe('createBroadcast', () => {
  const args = {
    clientId: TENANT,
    userId: USER,
    name: '  July nudge  ',
    template: TEMPLATE,
    filters: EMPTY_FILTERS,
    recipients: [
      { id: 'c1', name: 'Asha' },
      { id: 'c2', name: 'Ravi' },
    ],
    params: ['Hello {{contact_name}}'],
  }

  it('writes the broadcast, then one follow_up per recipient in the broadcast lane', async () => {
    responses.set('broadcasts', { data: { id: BROADCAST }, error: null })
    const res = await createBroadcast(args)
    expect(res.ok).toBe(true)

    const b = firstArg(callsTo('broadcasts')[0], 'insert') as Record<string, unknown>
    expect(b).toMatchObject({
      client_id: TENANT,
      name: 'July nudge',
      template_id: TEMPLATE.id,
      status: 'queued',
      counts: { queued: 2, sent: 0, failed: 0, replied: 0 },
      created_by: USER,
    })
    expect((b.segment_snapshot as { contact_ids: string[] }).contact_ids).toEqual(['c1', 'c2'])

    const rows = firstArg(callsTo('follow_ups')[0], 'insert') as Record<string, unknown>[]
    expect(rows).toHaveLength(2)
    for (const r of rows) {
      expect(r).toMatchObject({
        client_id: TENANT,
        channel: 'whatsapp',
        status: 'pending',
        sequence_key: `broadcast:${BROADCAST}`,
        created_by: USER,
      })
      // The broadcast drainer selects on meta->>'broadcast_id'; the follow-up
      // lane skips exactly these rows. Both halves of that split live here.
      expect(r.meta).toMatchObject({ kind: 'broadcast', broadcast_id: BROADCAST, template_id: TEMPLATE.id })
    }
    // {{contact_name}} is the one per-recipient substitution a blast gets.
    expect((rows[0].meta as { params: string[] }).params).toEqual(['Hello Asha'])
    expect((rows[1].meta as { params: string[] }).params).toEqual(['Hello Ravi'])
  })

  it('surfaces a rejected recipient insert instead of swallowing it', async () => {
    // Shape of the S2-D do-not-message guard refusing a guarded import cohort.
    responses.set('broadcasts', { data: { id: BROADCAST }, error: null })
    responses.set('follow_ups', { data: null, error: { message: 'cohort is guarded' } })
    const res = await createBroadcast(args)
    expect(res).toEqual({ ok: false, code: 'recipients_failed', detail: 'cohort is guarded' })
  })

  it('writes nothing for an empty segment', async () => {
    const res = await createBroadcast({ ...args, recipients: [] })
    expect(res).toEqual({ ok: false, code: 'empty_segment' })
    expect(calls).toHaveLength(0)
  })
})

describe('stopBroadcast', () => {
  it('stops only a sending broadcast and cancels its pending recipients', async () => {
    responses.set('broadcasts', { data: [{ id: BROADCAST }], error: null })
    const res = await stopBroadcast({
      id: BROADCAST,
      client_id: TENANT,
      name: 'n',
      template_id: TEMPLATE.id,
      status: 'sending',
      counts: null,
      created_at: '2026-09-03T00:00:00Z',
    })
    expect(res.ok).toBe(true)

    const eqs = callsTo('broadcasts')[0].ops.filter((o) => o.fn === 'eq').map((o) => o.args)
    expect(eqs).toContainEqual(['status', 'sending'])

    const fu = callsTo('follow_ups')[0]
    expect(firstArg(fu, 'update')).toMatchObject({ status: 'cancelled' })
    expect(fu.ops.filter((o) => o.fn === 'eq').map((o) => o.args)).toContainEqual([
      'sequence_key',
      `broadcast:${BROADCAST}`,
    ])
  })
})

describe('sendTemplateNow', () => {
  it('writes one follow_up the follow-up lane will claim', async () => {
    const res = await sendTemplateNow({
      clientId: TENANT,
      userId: USER,
      contactId: 'c1',
      conversationId: 'cv1',
      template: { ...TEMPLATE, variables: [] },
      params: [],
    })
    expect(res.ok).toBe(true)

    const row = firstArg(callsTo('follow_ups')[0], 'insert') as Record<string, unknown>
    expect(row).toMatchObject({
      client_id: TENANT,
      contact_id: 'c1',
      // Set even though the RPC could find one: the lane builds its send job
      // from the follow_up's own joins, and a null here resolves an empty
      // phone_number_id.
      conversation_id: 'cv1',
      channel: 'whatsapp',
      status: 'pending',
      created_by: USER,
      meta: { template_id: TEMPLATE.id, auto_send: true, params: [] },
    })
    // sequence_key would divert the row to the sequence lane; broadcast_id to
    // the broadcast lane. Neither may appear.
    expect(row.sequence_key).toBeUndefined()
    expect(row.meta).not.toHaveProperty('broadcast_id')
  })

  it('reports a refusal rather than reporting success', async () => {
    responses.set('follow_ups', { data: null, error: { message: 'denied' } })
    const res = await sendTemplateNow({
      clientId: TENANT,
      userId: USER,
      contactId: 'c1',
      conversationId: 'cv1',
      template: TEMPLATE,
      params: [''],
    })
    expect(res).toEqual({ ok: false, code: 'write_failed', detail: 'denied' })
  })
})
