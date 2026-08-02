import { describe, expect, it, vi } from 'vitest'
import type { LeadItem, LeadStage } from '../../lib/leads-data'
import { estimateDealProbability } from './DealProbability'

const stages: LeadStage[] = [
  { id: 'new', stage_key: 'new', label: 'New', sort_order: 1, is_won: false },
  { id: 'qualified', stage_key: 'qualified', label: 'Qualified', sort_order: 2, is_won: false },
  { id: 'commercial', stage_key: 'commercial', label: 'Commercial', sort_order: 3, is_won: false },
  { id: 'won', stage_key: 'won', label: 'Won', sort_order: 4, is_won: true },
]

function lead(overrides: Partial<LeadItem> = {}): LeadItem {
  return {
    id: 'deal-123',
    contact_id: 'contact-1',
    conversation_id: 'conversation-1',
    stage_id: 'new',
    status: 'open',
    est_value: 60000,
    temperature_override: null,
    next_action: null,
    objection: null,
    lost_reason: null,
    updated_at: '2026-08-01T09:00:00.000Z',
    contact: null,
    conversation: { assigned_to: null, last_customer_message_at: '2026-08-01T09:00:00.000Z' },
    ...overrides,
  }
}

describe('estimateDealProbability', () => {
  it('moves with pipeline stage instead of returning the same score for every deal', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-02T09:00:00.000Z'))
    expect(estimateDealProbability(lead({ stage_id: 'commercial' }), stages)).toBeGreaterThan(
      estimateDealProbability(lead({ stage_id: 'new' }), stages),
    )
    vi.useRealTimers()
  })

  it('treats won and lost outcomes as settled', () => {
    expect(estimateDealProbability(lead({ status: 'won' }), stages)).toBe(100)
    expect(estimateDealProbability(lead({ status: 'lost' }), stages)).toBe(0)
  })
})
