import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Same recorder-builder pattern as calls-data.test.ts: the Supabase client is a
// Proxy that records every builder call and resolves via a per-table response
// the test sets up front. `rpc` is a plain vi.fn — the two 068 writers call it
// directly with no chaining.
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

const {
  SALES_CONFIG_DEFAULTS,
  SPIN_MAX_CHARS,
  closeGap,
  deleteSpin,
  parseSalesConfig,
  setItemSalesFacts,
  setSalesConfig,
  spinIsStale,
  spinSeedText,
  toSalesConfigJson,
  upsertSpin,
  useCourses,
  useSalesConfig,
  useTeardown,
  weekStart,
} = await import('./sales-settings-data')

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
  fromMock.mockClear()
})

describe('parseSalesConfig', () => {
  it('reads the demo tenant shape', () => {
    expect(
      parseSalesConfig({
        languages: ['en', 'mn', 'hi'],
        default_lang: 'mn',
        upi_vpa: 'vidyasagar@ybl',
        upi_payee: 'Vidya Sagar Academy',
        pay_url: 'https://example.invalid/pay',
        token_amount: 500,
        token_note: 'Seat reservation',
      }),
    ).toEqual({
      languages: ['en', 'mn', 'hi'],
      defaultLang: 'mn',
      upiVpa: 'vidyasagar@ybl',
      upiPayee: 'Vidya Sagar Academy',
      payUrl: 'https://example.invalid/pay',
      tokenAmount: 500,
      tokenNote: 'Seat reservation',
    })
  })

  it('falls back to safe defaults for a tenant that never opened Settings', () => {
    expect(parseSalesConfig({})).toEqual(SALES_CONFIG_DEFAULTS)
    expect(parseSalesConfig(null)).toEqual(SALES_CONFIG_DEFAULTS)
  })

  it('always offers English — every base body is written in it', () => {
    expect(parseSalesConfig({ languages: ['mn'] }).languages).toEqual(['en', 'mn'])
  })

  it('ignores a junk token amount rather than rendering NaN into the pay text', () => {
    expect(parseSalesConfig({ token_amount: 'lots' }).tokenAmount).toBe(500)
    expect(parseSalesConfig({ token_amount: -20 }).tokenAmount).toBe(500)
    expect(parseSalesConfig({ token_amount: '750' }).tokenAmount).toBe(750)
  })
})

describe('toSalesConfigJson', () => {
  // pm_set_sales_config shallow-MERGES, so an absent key must stay absent.
  it('sends only the keys being changed', () => {
    expect(toSalesConfigJson({ tokenAmount: 750 })).toEqual({ token_amount: 750 })
  })

  it('sends an empty string when a field is deliberately cleared', () => {
    expect(toSalesConfigJson({ upiVpa: '' })).toEqual({ upi_vpa: '' })
  })
})

describe('useSalesConfig', () => {
  it('reads sales_config for the client and parses it', async () => {
    responses.set('clients', { data: { sales_config: { default_lang: 'mn' } }, error: null })
    const { result } = renderHook(() => useSalesConfig('client-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.config.defaultLang).toBe('mn')
    expect(opArgs(lastCall('clients'), 'eq')).toEqual([['id', 'client-1']])
  })

  it('settles to defaults without querying when there is no client', async () => {
    const { result } = renderHook(() => useSalesConfig(null))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.config).toEqual(SALES_CONFIG_DEFAULTS)
    expect(fromMock).not.toHaveBeenCalled()
  })
})

describe('setSalesConfig', () => {
  it('calls pm_set_sales_config with the snake_case patch', async () => {
    rpcMock.mockResolvedValueOnce({ data: {}, error: null })
    expect(await setSalesConfig('client-1', { tokenAmount: 750 })).toEqual({ ok: true })
    expect(rpcMock).toHaveBeenCalledWith('pm_set_sales_config', {
      p_client_id: 'client-1',
      p_config: { token_amount: 750 },
    })
  })

  // ★ edge case: a rep hitting the manager wall must read a sentence, not a
  // Postgres string. The caller rolls its optimistic state back on ok:false.
  it('maps the RPC 42501 wall to "Managers only"', async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { code: '42501', message: 'setting sales config requires manager or client_admin' },
    })
    const result = await setSalesConfig('client-1', { tokenAmount: 750 })
    expect(result).toEqual({ ok: false, message: 'Managers only — ask an admin to change this.' })
  })

  it('passes any other error through verbatim', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { code: '22023', message: 'must be a JSON object' } })
    expect(await setSalesConfig('client-1', {})).toEqual({ ok: false, message: 'must be a JSON object' })
  })
})

describe('setItemSalesFacts', () => {
  // The RPC REPLACES sales_facts, so the caller must send the whole object.
  it('sends the whole facts object to pm_set_item_sales_facts', async () => {
    rpcMock.mockResolvedValueOnce({ data: {}, error: null })
    const facts = { fee: 85000, emi_monthly: 7100 }
    expect(await setItemSalesFacts('item-1', facts)).toEqual({ ok: true })
    expect(rpcMock).toHaveBeenCalledWith('pm_set_item_sales_facts', { p_item_id: 'item-1', p_facts: facts })
  })

  it('maps the manager wall the same way', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'requires manager' } })
    expect(await setItemSalesFacts('item-1', {})).toEqual({
      ok: false,
      message: 'Managers only — ask an admin to change this.',
    })
  })
})

describe('useCourses', () => {
  it('reads active items ordered by name and defaults a null sales_facts', async () => {
    responses.set('items', {
      data: [{ id: 'i-1', name: 'NEET Repeater', slug: 'neet', price: 85000, sales_facts: null }],
      error: null,
    })
    const { result } = renderHook(() => useCourses('client-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.courses).toEqual([
      { id: 'i-1', name: 'NEET Repeater', slug: 'neet', price: 85000, facts: {} },
    ])
    const rec = lastCall('items')
    expect(opArgs(rec, 'eq')).toEqual([
      ['client_id', 'client-1'],
      ['active', true],
    ])
    expect(opArgs(rec, 'order')).toEqual([['name', { ascending: true }]])
  })
})

describe('upsertSpin', () => {
  const base = { clientId: 'c-1', userId: 'u-1', scriptId: 's-1', lang: 'mn', title: 'Fee / EMI' }

  // ★ edge case: the limit is refused with a message, not silently truncated.
  it('refuses a spin over the character limit and never writes', async () => {
    const result = await upsertSpin({ ...base, body: 'x'.repeat(SPIN_MAX_CHARS + 1) })
    expect(result).toEqual({
      ok: false,
      message: `Keep it under ${SPIN_MAX_CHARS} characters — yours is ${SPIN_MAX_CHARS + 1}.`,
    })
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('refuses an empty spin', async () => {
    expect(await upsertSpin({ ...base, body: '   ' })).toEqual({ ok: false, message: 'Write your version first.' })
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('inserts when the rep has no spin for that script and dialect yet', async () => {
    responses.set('quick_replies', { data: null, error: null })
    expect(await upsertSpin({ ...base, body: 'My words' })).toEqual({ ok: true })
    const inserts = opArgs(lastCall('quick_replies'), 'insert')
    expect(inserts).toHaveLength(1)
    expect(inserts[0][0]).toEqual({
      client_id: 'c-1',
      created_by: 'u-1',
      script_id: 's-1',
      lang: 'mn',
      scope: 'personal',
      title: 'Fee / EMI',
      body: 'My words',
    })
  })

  it('updates the existing row instead of inserting a duplicate', async () => {
    responses.set('quick_replies', { data: { id: 'qr-1' }, error: null })
    expect(await upsertSpin({ ...base, body: 'Revised words' })).toEqual({ ok: true })
    const rec = lastCall('quick_replies')
    expect(opArgs(rec, 'insert')).toHaveLength(0)
    expect(opArgs(rec, 'update')[0][0]).toEqual({ title: 'Fee / EMI', body: 'Revised words', active: true })
  })

  it('trims before storing so the counter and the stored body agree', async () => {
    responses.set('quick_replies', { data: null, error: null })
    await upsertSpin({ ...base, body: '  spaced  ' })
    expect((opArgs(lastCall('quick_replies'), 'insert')[0][0] as { body: string }).body).toBe('spaced')
  })
})

describe('deleteSpin', () => {
  it('scopes the delete by client and id', async () => {
    responses.set('quick_replies', { data: null, error: null })
    expect(await deleteSpin('c-1', 'qr-1')).toEqual({ ok: true })
    const rec = lastCall('quick_replies')
    expect(opArgs(rec, 'delete')).toHaveLength(1)
    expect(opArgs(rec, 'eq')).toEqual([
      ['client_id', 'c-1'],
      ['id', 'qr-1'],
    ])
  })
})

describe('spinIsStale', () => {
  it('is true when the standard was rewritten after the spin was saved', () => {
    expect(spinIsStale('2026-09-02T10:00:00Z', '2026-09-01T10:00:00Z')).toBe(true)
  })

  it('is false when the spin is newer, and when there is no standard at all', () => {
    expect(spinIsStale('2026-09-01T10:00:00Z', '2026-09-02T10:00:00Z')).toBe(false)
    expect(spinIsStale(null, '2026-09-02T10:00:00Z')).toBe(false)
  })
})

describe('spinSeedText', () => {
  it('seeds from the dialect variant when one exists, tokens intact', () => {
    const body = {
      paragraphs: [{ before: 'English' }],
      lang: 'en',
      variants: { mn: { paragraphs: [{ before: 'Hi {{name}}, ', highlight: 'fee is ₹{{course.fee}}' }] } },
    }
    expect(spinSeedText(body, 'mn')).toBe('Hi {{name}}, fee is ₹{{course.fee}}')
  })

  it('seeds from the base body when the dialect is missing', () => {
    expect(spinSeedText({ paragraphs: [{ before: 'English' }], lang: 'en' }, 'hi')).toBe('English')
    expect(spinSeedText(null, 'en')).toBe('')
  })
})

describe('weekStart', () => {
  it('snaps to Monday 00:00', () => {
    // 2026-09-02 is a Wednesday.
    const start = weekStart(new Date(2026, 8, 2, 15, 30))
    expect(start.getDay()).toBe(1)
    expect(start.getDate()).toBe(31) // Mon 31 Aug 2026
    expect(start.getHours()).toBe(0)
  })

  it('treats Sunday as the end of the week that began six days earlier', () => {
    // 2026-09-06 is a Sunday.
    expect(weekStart(new Date(2026, 8, 6, 12, 0)).getDate()).toBe(31)
  })
})

describe('useTeardown', () => {
  it('ranks objections by volume and skips undone logs', async () => {
    responses.set('objection_logs', {
      data: [{ taxonomy_id: 't-1' }, { taxonomy_id: 't-2' }, { taxonomy_id: 't-1' }],
      error: null,
    })
    responses.set('objection_taxonomy', {
      data: [
        { id: 't-1', label: 'Fee / EMI' },
        { id: 't-2', label: 'Ask parents' },
      ],
      error: null,
    })
    responses.set('playbook_gaps', { data: [], error: null })
    responses.set('profiles', { data: [], error: null })

    const { result } = renderHook(() => useTeardown('client-1', weekStart(new Date(2026, 8, 2))))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.objections).toEqual([
      { taxonomyId: 't-1', label: 'Fee / EMI', count: 2 },
      { taxonomyId: 't-2', label: 'Ask parents', count: 1 },
    ])
    // The undone filter is what keeps a corrected log out of the week's ranking.
    expect(opArgs(lastCall('objection_logs'), 'is')).toEqual([['undone_at', null]])
  })

  it('labels open gaps with their taxonomy and author display name', async () => {
    responses.set('objection_logs', { data: [], error: null })
    responses.set('objection_taxonomy', { data: [{ id: 't-1', label: 'Fee / EMI' }], error: null })
    responses.set('profiles', { data: [{ user_id: 'u-9', display_name: 'Ravi Menon' }], error: null })
    responses.set('playbook_gaps', {
      data: [
        {
          id: 'g-1',
          taxonomy_id: 't-1',
          exact_customer_words: 'too costly for us',
          created_by: 'u-9',
          created_at: '2026-09-01T10:00:00Z',
        },
      ],
      error: null,
    })

    const { result } = renderHook(() => useTeardown('client-1', weekStart(new Date(2026, 8, 2))))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.gaps).toEqual([
      {
        id: 'g-1',
        taxonomyId: 't-1',
        label: 'Fee / EMI',
        words: 'too costly for us',
        authorName: 'Ravi Menon',
        createdAt: '2026-09-01T10:00:00Z',
      },
    ])
  })

  it('surfaces a read error instead of rendering an empty week as a quiet one', async () => {
    responses.set('objection_logs', { data: null, error: { message: 'permission denied' } })
    const { result } = renderHook(() => useTeardown('client-1', weekStart(new Date(2026, 8, 2))))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('permission denied')
  })
})

describe('closeGap', () => {
  it('marks the gap closed with a timestamp', async () => {
    responses.set('playbook_gaps', { data: [{ id: 'g-1' }], error: null })
    expect(await closeGap('c-1', 'g-1')).toEqual({ ok: true })
    const patch = opArgs(lastCall('playbook_gaps'), 'update')[0][0] as { status: string; closed_at: string }
    expect(patch.status).toBe('closed')
    expect(patch.closed_at).toEqual(expect.any(String))
  })

  it('reports the role wall when RLS silently updates nothing', async () => {
    responses.set('playbook_gaps', { data: [], error: null })
    expect(await closeGap('c-1', 'g-1')).toEqual({
      ok: false,
      message: 'Managers only — ask an admin to change this.',
    })
  })
})
