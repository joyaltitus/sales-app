import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CACHE_KEYS, cached } from './cache'
import type { QueueItem } from './contracts'

let resolveQueue: (value: { data: QueueItem[]; error: null }) => void
const query = vi.hoisted(() => ({
  from: vi.fn(),
}))

vi.mock('./panel-client', () => ({ panelSupabase: query }))
vi.mock('@app/lib/scripts-data', () => ({ useScriptLibrary: vi.fn() }))

import { useRepQueue } from './panel-data'

const item = (leadId: string): QueueItem => ({
  lead_id: leadId,
  contact_id: `contact-${leadId}`,
  person_id: null,
  display_name: leadId,
  phone_e164: null,
  channel: 'phone',
  stage_key: 'new',
  stage_label: 'New',
  status: 'open',
  owner: null,
  due_at: null,
  follow_up_id: null,
  last_activity_at: null,
  reason: 'new',
})

describe('useRepQueue stale-while-revalidate', () => {
  beforeEach(() => {
    const network = new Promise<{ data: QueueItem[]; error: null }>((resolve) => { resolveQueue = resolve })
    const builder = {
      select: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(() => network),
    }
    builder.select.mockReturnValue(builder)
    builder.order.mockReturnValue(builder)
    query.from.mockReturnValue(builder)
  })

  it('paints a scoped cache before the network response and replaces it after revalidation', async () => {
    await chrome.storage.local.set({
      [CACHE_KEYS.queue]: cached([item('cached-lead')], new Date('2026-08-26T10:00:00Z'), 'client-1'),
    })
    const { result } = renderHook(() => useRepQueue({ userId: 'user-1', clientId: 'client-1', displayName: 'Rep' }))

    await waitFor(() => expect(result.current.items[0]?.lead_id).toBe('cached-lead'))
    expect(result.current.loading).toBe(false)
    expect(result.current.staleAt).toBe('2026-08-26T10:00:00.000Z')

    resolveQueue({ data: [item('fresh-lead')], error: null })
    await waitFor(() => expect(result.current.items[0]?.lead_id).toBe('fresh-lead'))
    expect(result.current.staleAt).toBeNull()
  })
})
