import { describe, expect, it } from 'vitest'
import { CACHE_KEYS, cacheLeadDetail, cached, readCache } from './cache'
import type { LeadDetail } from './contracts'

function detail(id: string): LeadDetail {
  return {
    lead: {
      lead_id: id, contact_id: `contact-${id}`, person_id: null, display_name: id,
      phone_e164: null, channel: 'phone', stage_key: 'new', stage_label: 'New', status: 'open',
      owner: null, due_at: null, follow_up_id: null, last_activity_at: null, reason: 'new',
    },
    facts: [], objections: [], timeline: [], source: 'rep',
  }
}

describe('lead detail cache', () => {
  it('keeps the 20 most recently opened distinct leads with visible fetch timestamps', async () => {
    for (let index = 0; index < 21; index += 1) {
      await cacheLeadDetail(cached(detail(`lead-${index}`), new Date(`2026-08-26T10:${String(index).padStart(2, '0')}:00Z`)))
    }
    const stored = await readCache(CACHE_KEYS.leadDetails)
    expect(stored).toHaveLength(20)
    expect(stored?.[0].data.lead.lead_id).toBe('lead-20')
    expect(stored?.[0].fetched_at).toBe('2026-08-26T10:20:00.000Z')
    expect(stored?.some((item) => item.data.lead.lead_id === 'lead-0')).toBe(false)
  })

  it('records the client scope with cached data', () => {
    expect(cached([], new Date('2026-08-26T10:00:00Z'), 'client-1')).toEqual({
      data: [],
      fetched_at: '2026-08-26T10:00:00.000Z',
      scope: 'client-1',
    })
  })
})
