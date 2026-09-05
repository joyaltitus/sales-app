import { beforeEach, describe, expect, it, vi } from 'vitest'

// Same recorder-builder Proxy as team-data.test.ts / calls-data.test.ts: the
// Supabase client records every builder call so the assertions run against what
// the module actually ISSUED, not against a restatement of its source.
type Op = { fn: string; args: unknown[] }
type Recorded = { table: string; ops: Op[] }

const { calls, rpcCalls, responses, rpcResponses, supabaseMock } = vi.hoisted(() => {
  const calls: Recorded[] = []
  const rpcCalls: { fn: string; args: unknown }[] = []
  const responses = new Map<string, { data: unknown; error: unknown }>()
  const rpcResponses = new Map<string, { data: unknown; error: unknown }>()

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
    rpcCalls,
    responses,
    rpcResponses,
    supabaseMock: {
      from: vi.fn((table: string) => {
        const rec: Recorded = { table, ops: [] }
        calls.push(rec)
        return makeBuilder(rec)
      }),
      rpc: vi.fn((fn: string, args: unknown) => {
        rpcCalls.push({ fn, args })
        return Promise.resolve(rpcResponses.get(fn) ?? { data: { ok: true }, error: null })
      }),
    },
  }
})

const { hubFetchMock } = vi.hoisted(() => ({ hubFetchMock: vi.fn() }))

vi.mock('./supabase', () => ({ supabase: supabaseMock }))
vi.mock('./api', () => ({ hubFetch: hubFetchMock }))

const {
  honestyLint,
  triggerSentence,
  createCampaign,
  saveProduct,
  revertTo,
  lintKeywords,
  deactivateRecord,
} = await import('./manage-data')

const TENANT = 'a0de0000-0000-4000-8000-000000000001'
const USER = '11111111-1111-4111-8111-111111111111'

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
  rpcCalls.length = 0
  responses.clear()
  rpcResponses.clear()
  hubFetchMock.mockReset()
  supabaseMock.from.mockClear()
  supabaseMock.rpc.mockClear()
})

describe('honestyLint — authoring lint, not a wall', () => {
  it('names the family a guest-facing promise falls into', () => {
    expect(honestyLint('We guarantee your seat').map((w) => w.key)).toEqual(['guarantee'])
    expect(honestyLint('Flat 20% discount today').map((w) => w.key)).toEqual(['discount'])
    expect(honestyLint('Your seat is held for you').map((w) => w.key)).toEqual(['confirmation'])
  })

  it('says nothing about ordinary copy', () => {
    expect(honestyLint('Two-hour session, Saturdays, at the Kochi centre')).toEqual([])
    expect(honestyLint(null)).toEqual([])
  })
})

describe('triggerSentence — trigger words are read-only, in plain language', () => {
  it('reads as a sentence, not a field', () => {
    expect(triggerSentence({ trigger_keywords: ['too costly'], match_mode: 'any' })).toBe(
      'This reply fires when someone says “too costly”.',
    )
  })

  it('uses the rule’s own match mode as the joiner', () => {
    expect(triggerSentence({ trigger_keywords: ['price', 'cost'], match_mode: 'any' })).toContain(' or ')
    expect(triggerSentence({ trigger_keywords: ['price', 'cost'], match_mode: 'all' })).toContain(' and ')
  })

  it('does not invent a trigger for a rule that has none', () => {
    expect(triggerSentence({ trigger_keywords: [], match_mode: 'any' })).toContain('not by a trigger word')
  })
})

describe('reads are tenant-scoped and bounded', () => {
  it('scopes and bounds the revision read', async () => {
    const { useRevisions } = await import('./manage-data')
    const { renderHook, waitFor } = await import('@testing-library/react')
    responses.set('record_revisions', { data: [], error: null })
    renderHook(() => useRevisions(TENANT, 'items', 'row-1'))
    await waitFor(() => expect(calls.some((c) => c.table === 'record_revisions')).toBe(true))
    const rec = lastCall('record_revisions')
    expect(opArgs(rec, 'eq')).toContainEqual(['client_id', TENANT])
    expect(opArgs(rec, 'eq')).toContainEqual(['record_pk', 'row-1'])
    expect(opArgs(rec, 'limit').length).toBeGreaterThan(0)
  })
})

describe('createCampaign — never sends a column 069 locks', () => {
  it('omits trigger, spend_minor and created_by from the insert', async () => {
    await createCampaign(TENANT, {
      campaign_key: 'diwali_2026',
      name: 'Diwali 2026',
      channel: 'google_ads',
      context_text: 'Ends 30 November.',
      starts_at: null,
      ends_at: null,
      active: true,
    })
    const [payload] = opArgs(lastCall('campaigns'), 'insert')[0] as [Record<string, unknown>]
    expect(payload.client_id).toBe(TENANT)
    expect(payload.campaign_key).toBe('diwali_2026')
    // The BEFORE trigger overwrites all three on a browser insert. Sending one
    // is a statement waiting to fail, so the module must not.
    expect(payload).not.toHaveProperty('trigger')
    expect(payload).not.toHaveProperty('spend_minor')
    expect(payload).not.toHaveProperty('created_by')
  })
})

describe('saveProduct — slug is not in the patch', () => {
  it('sends only the client-tier columns', async () => {
    responses.set('items', { data: [{ id: 'p-1' }], error: null })
    await saveProduct(TENANT, 'p-1', {
      name: 'Weekend intensive',
      category: 'course',
      description: 'Two Saturdays.',
      price: 12000,
      ai_instruction: 'Lead with the schedule.',
    })
    const [patch] = opArgs(lastCall('items'), 'update')[0] as [Record<string, unknown>]
    expect(patch).not.toHaveProperty('slug')
    expect(patch.price).toBe(12000)
    expect(opArgs(lastCall('items'), 'eq')).toContainEqual(['client_id', TENANT])
  })

  it('reports an RLS refusal (zero rows) as denied, not as success', async () => {
    responses.set('items', { data: [], error: null })
    const res = await saveProduct(TENANT, 'p-1', {
      name: 'x',
      category: null,
      description: null,
      price: 1,
      ai_instruction: null,
    })
    expect(res).toEqual({ ok: false, code: 'denied' })
  })
})

describe('lintKeywords — a block is a refusal, not a warning', () => {
  it('surfaces has_block from the RPC verbatim', async () => {
    rpcResponses.set('pm_lint_keywords', {
      data: {
        ok: true,
        collisions: [{ keyword: 'stop', kind: 'optout', ref: null, severity: 'block' }],
        has_block: true,
      },
      error: null,
    })
    const res = await lintKeywords(TENANT, ['stop'], 'knowledge')
    expect(res.has_block).toBe(true)
    expect(res.collisions[0].kind).toBe('optout')
  })

  it('does not call the RPC for an empty keyword set', async () => {
    await lintKeywords(TENANT, [], 'knowledge')
    expect(rpcCalls).toHaveLength(0)
  })
})

describe('deactivateRecord — the blast radius is data, not an error', () => {
  it('returns refs on success so the caller can show them', async () => {
    rpcResponses.set('pm_manage_record', {
      data: { ok: true, refs: [{ kind: 'rule', ref: 'tell_fees' }] },
      error: null,
    })
    const res = await deactivateRecord(TENANT, 'item', 'weekend-intensive', USER)
    expect(res).toEqual({ ok: true, refs: [{ kind: 'rule', ref: 'tell_fees' }] })
    expect(rpcCalls[0].args).toMatchObject({
      p_client_id: TENANT,
      p_kind: 'item',
      p_record_key: 'weekend-intensive',
      p_action: 'deactivate',
    })
  })
})

// ---------------------------------------------------------------------------
// The judgment call of this session: a revert is a FORWARD write.
// ---------------------------------------------------------------------------
describe('revertTo — replays `before` through the same door, never a raw rewind', () => {
  const base = {
    id: 'rev-1',
    record_pk: 'row-1',
    record_key: null as string | null,
    op: 'update' as const,
    after: {},
    actor: USER,
    source: 'ui_edit',
    created_at: '2026-09-01T10:00:00Z',
  }

  it('restores only the columns the tab itself can edit', async () => {
    responses.set('items', { data: [{ id: 'row-1' }], error: null })
    const res = await revertTo(
      TENANT,
      {
        ...base,
        table_name: 'items',
        record_key: 'weekend-intensive',
        before: {
          id: 'row-1',
          client_id: TENANT,
          // Locked columns ride along in every whole-row snapshot. Replaying
          // them verbatim would make tg_items_lock_slug raise and fail the
          // WHOLE statement, so the restore must not carry them.
          slug: 'an-older-slug',
          created_at: '2026-01-01T00:00:00Z',
          name: 'Weekend intensive',
          price: 9000,
          description: 'The older description.',
          ai_instruction: null,
          category: 'course',
          active: true,
        },
      },
      USER,
    )
    expect(res).toEqual({ ok: true })
    const [patch] = opArgs(lastCall('items'), 'update')[0] as [Record<string, unknown>]
    expect(patch).toEqual({
      name: 'Weekend intensive',
      category: 'course',
      description: 'The older description.',
      price: 9000,
      ai_instruction: null,
      active: true,
    })
    expect(patch).not.toHaveProperty('slug')
    expect(patch).not.toHaveProperty('client_id')
    expect(patch).not.toHaveProperty('id')
  })

  it('sends a rule restore through pm_edit_rule_response, not through the table', async () => {
    rpcResponses.set('pm_edit_rule_response', { data: { ok: true }, error: null })
    const res = await revertTo(
      TENANT,
      {
        ...base,
        table_name: 'playbook_rules',
        record_key: 'obj_price_400',
        before: {
          rule_key: 'obj_price_400',
          response_text: 'The older answer.',
          media_bundle_key: 'fees_pack',
          // The rest of the row is super_admin's and must not move.
          priority: 400,
          trigger_keywords: ['costly'],
        },
      },
      USER,
    )
    expect(res).toEqual({ ok: true })
    expect(calls.some((c) => c.table === 'playbook_rules')).toBe(false)
    expect(rpcCalls).toEqual([
      {
        fn: 'pm_edit_rule_response',
        args: {
          p_client_id: TENANT,
          p_rule_key: 'obj_price_400',
          p_response_text: 'The older answer.',
          p_media_bundle_key: 'fees_pack',
          p_auth_user_id: USER,
        },
      },
    ])
  })

  it('re-runs the collision gate when it restores a campaign code word', async () => {
    responses.set('campaigns', { data: [{ id: 'row-1' }], error: null })
    rpcResponses.set('pm_set_campaign_trigger', { data: { ok: true, warnings: [] }, error: null })
    rpcResponses.set('pm_set_campaign_spend', { data: { ok: true }, error: null })
    const res = await revertTo(
      TENANT,
      {
        ...base,
        table_name: 'campaigns',
        record_key: 'diwali_2026',
        before: {
          campaign_key: 'diwali_2026',
          name: 'Diwali 2026',
          context_text: 'Older copy.',
          starts_at: null,
          ends_at: null,
          active: true,
          trigger: { code_keywords: ['diwali'], ctwa_source_ids: ['ad-9'] },
          spend_minor: 250000,
          created_by: 'someone-else',
        },
      },
      USER,
    )
    expect(res).toEqual({ ok: true })
    const [patch] = opArgs(lastCall('campaigns'), 'update')[0] as [Record<string, unknown>]
    expect(patch).not.toHaveProperty('trigger')
    expect(patch).not.toHaveProperty('spend_minor')
    expect(patch).not.toHaveProperty('created_by')
    expect(rpcCalls.map((c) => c.fn)).toEqual(['pm_set_campaign_trigger', 'pm_set_campaign_spend'])
    expect(rpcCalls[0].args).toMatchObject({
      p_campaign_key: 'diwali_2026',
      p_code_keywords: ['diwali'],
      p_ctwa_source_ids: ['ad-9'],
    })
    expect(rpcCalls[1].args).toMatchObject({ p_spend_minor: 250000 })
  })

  it('reports a HALF-restored campaign when the gate refuses the code words', async () => {
    responses.set('campaigns', { data: [{ id: 'row-1' }], error: null })
    rpcResponses.set('pm_set_campaign_trigger', {
      data: {
        ok: false,
        collisions: [{ keyword: 'stop', kind: 'optout', ref: null, severity: 'block' }],
      },
      error: null,
    })
    const res = await revertTo(
      TENANT,
      {
        ...base,
        table_name: 'campaigns',
        record_key: 'diwali_2026',
        before: {
          campaign_key: 'diwali_2026',
          name: 'Diwali 2026',
          context_text: null,
          starts_at: null,
          ends_at: null,
          active: true,
          trigger: { code_keywords: ['stop'], ctwa_source_ids: [] },
          spend_minor: 0,
        },
      },
      USER,
    )
    // FLIPPED from `{ ok: false, code: 'collision' }`. The old shape was
    // indistinguishable from a refusal that changed nothing, and HistoryDrawer
    // rendered exactly those words — while the campaigns row, `active`
    // included, had already committed on the line above.
    expect(res).toEqual({ ok: false, code: 'partial:collision', detail: 'code words' })
    // The row DID change. That is the whole point of the partial code.
    expect(opArgs(lastCall('campaigns'), 'update')).toHaveLength(1)
    // The spend leg must not run once the gate refused.
    expect(rpcCalls.map((c) => c.fn)).toEqual(['pm_set_campaign_trigger'])
  })

  it('refuses an insert revision — there is no earlier version to restore', async () => {
    const res = await revertTo(
      TENANT,
      { ...base, table_name: 'items', op: 'insert', before: null },
      USER,
    )
    expect(res).toEqual({ ok: false, code: 'nothing_to_restore' })
    expect(calls).toHaveLength(0)
  })

  it('refuses a table it has no forward door for', async () => {
    const res = await revertTo(
      TENANT,
      { ...base, table_name: 'user_client_memberships', before: { role: 'client_admin' } },
      USER,
    )
    expect(res).toEqual({ ok: false, code: 'not_revertable' })
    expect(calls).toHaveLength(0)
  })
})
