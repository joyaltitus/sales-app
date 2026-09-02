import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CACHE_KEYS, cached } from './cache'
import { playbookLibrary } from '../fixtures'
import type { OutboxEntry } from './contracts'

const query = vi.hoisted(() => ({ from: vi.fn() }))
const drained = vi.hoisted(() => [] as string[])

vi.mock('./panel-client', () => ({ panelSupabase: query, HUB_URL: 'https://hub.test' }))

import { composeLibrary, usePlaybookLibrary } from './panel-data'
import { OUTBOX_KEY, drainOutbox, queueWrite } from './outbox-store'
import * as store from './outbox-store'

/** Every read fails: the panel is on a train. */
function offline() {
  const builder = {
    select: vi.fn(), eq: vi.fn(), order: vi.fn(), limit: vi.fn(), maybeSingle: vi.fn(),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: null, error: { message: 'offline' } }).then(resolve),
  }
  builder.select.mockReturnValue(builder)
  builder.eq.mockReturnValue(builder)
  builder.order.mockReturnValue(builder)
  builder.limit.mockReturnValue(builder)
  builder.maybeSingle.mockResolvedValue({ data: null, error: { message: 'offline' } })
  query.from.mockReturnValue(builder)
}

beforeEach(() => {
  drained.length = 0
  offline()
})

// ★ B8: offline the chips still render, from the cache, and say they are stale.
describe('usePlaybookLibrary offline', () => {
  it('serves the cached playbook and flags it stale instead of showing an error', async () => {
    await chrome.storage.local.set({
      [CACHE_KEYS.library]: cached(playbookLibrary, new Date('2026-09-02T04:00:00Z'), 'client-1'),
    })

    const { result } = renderHook(() => usePlaybookLibrary('client-1', 'user-1'))

    await waitFor(() => expect(result.current.scripts.length).toBeGreaterThan(0))
    expect(result.current.loading).toBe(false)
    expect(result.current.staleAt).toBe('2026-09-02T04:00:00.000Z')
    // A cached answer on screen outranks the error that failed to replace it.
    expect(result.current.error).toBeNull()
    expect(result.current.scripts.some((script) => script.taxonomy_key === 'price')).toBe(true)
    expect(result.current.config?.upi_vpa).toBe('bright@okhdfcbank')
  })

  it('another workspace never sees this one’s cache', async () => {
    await chrome.storage.local.set({
      [CACHE_KEYS.library]: cached(playbookLibrary, new Date('2026-09-02T04:00:00Z'), 'client-1'),
    })
    const { result } = renderHook(() => usePlaybookLibrary('client-2', 'user-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.scripts).toHaveLength(0)
    expect(result.current.staleAt).toBeNull()
  })
})

describe('composeLibrary', () => {
  it('resolves standard over testing over highest version, and joins win rates', () => {
    const library = composeLibrary({
      taxonomy: [{ id: 't1', key: 'price', label: 'Too expensive', kind: 'objection', position: 3, icon: 'wallet', status: 'active' }],
      versions: [
        { id: 'v3', script_id: 's1', version: 3, status: 'draft', headline: null, body: null, created_at: 'c', scripts: { id: 's1', taxonomy_id: 't1' } },
        { id: 'v2', script_id: 's1', version: 2, status: 'standard', headline: 'Anchor', body: { paragraphs: [{ before: 'hi' }], lang: 'en', variants: { mn: { paragraphs: [{ before: 'hai' }] } } }, created_at: 'c', scripts: { id: 's1', taxonomy_id: 't1' } },
        { id: 'v1', script_id: 's1', version: 1, status: 'testing', headline: null, body: null, created_at: 'c', scripts: { id: 's1', taxonomy_id: 't1' } },
      ],
      winRates: [{ script_version_id: 'v2', uses: 20, rated: 18, won: 12 }],
      courses: [], config: null,
      spins: [{ id: 'sp1', script_id: 's1', lang: 'mn', title: 'Too expensive', body: 'ente version', updated_at: '2026-08-30T00:00:00.000Z' }],
    })
    const script = library.scripts[0]!
    expect(script.script_version_id).toBe('v2')
    expect(script.langs).toEqual(['en', 'mn'])
    expect(script).toMatchObject({ uses: 20, rated: 18, won: 12, icon: 'wallet', position: 3 })
    expect(script.spin?.body).toBe('ente version')
  })

  it('keeps a taxonomy row with no script at all, rather than dropping the gap', () => {
    const library = composeLibrary({
      taxonomy: [{ id: 't9', key: 'trust', label: 'Never heard of you', kind: 'objection', position: 9, icon: null, status: 'active' }],
      versions: [], winRates: [], courses: [], config: null, spins: [],
    })
    expect(library.scripts[0]).toMatchObject({ script_version_id: null, body: null, uses: 0, rated: 0 })
  })
})

// ★ B8 (second half): going back online drains oldest-first, in order, and
// stops at the first failure rather than skipping past it.
describe('draining what the call queued', () => {
  it('replays usage, then feedback, then the spin — and holds the rest when one fails', async () => {
    vi.spyOn(store.WRITE_REGISTRY, 'script_used').mockImplementation(async (entry) => { drained.push(`used:${entry.id}`) })
    vi.spyOn(store.WRITE_REGISTRY, 'script_feedback').mockImplementation(async () => { drained.push('feedback') })
    vi.spyOn(store.WRITE_REGISTRY, 'save_spin').mockImplementation(async () => { throw new Error('still offline') })

    await queueWrite('script_used', { client_id: 'c1' }, new Date(), 'usage-1')
    await queueWrite('script_feedback', { client_id: 'c1', usage_id: 'usage-1', feedback: 'worked' })
    await queueWrite('save_spin', { client_id: 'c1', script_id: 's1', lang: 'en' })

    const result = await drainOutbox()
    expect(drained).toEqual(['used:usage-1', 'feedback'])
    expect(result.done).toBe(2)
    expect(result.failed?.kind).toBe('save_spin')

    const left = (await chrome.storage.local.get(OUTBOX_KEY))[OUTBOX_KEY] as OutboxEntry[]
    expect(left.map((entry) => entry.kind)).toEqual(['save_spin'])
    expect(left[0]!.attempts).toBe(1)
    expect(left[0]!.last_error).toBe('still offline')
  })

  it('re-queuing the same usage handle while it is still pending adds nothing', async () => {
    await queueWrite('script_used', { client_id: 'c1' }, new Date(), 'usage-1')
    await queueWrite('script_used', { client_id: 'c1' }, new Date(), 'usage-1')
    const pending = (await chrome.storage.local.get(OUTBOX_KEY))[OUTBOX_KEY] as OutboxEntry[]
    expect(pending).toHaveLength(1)
  })
})
