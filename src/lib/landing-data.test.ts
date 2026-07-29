import { describe, expect, it } from 'vitest'
import type { QueueItem } from './inbox-data'
import {
  isUnanswered,
  waitingLongest,
  unpickedEscalations,
  pausedThreads,
  dueToday,
  isOverdue,
} from './landing-data'

// The landings' logic lives in pure functions precisely so it can be tested
// without a DOM, a router or a database. These are acceptance criteria 6-9 from
// the approved spec sheet.

const T = (iso: string) => new Date(iso).toISOString()
const NOW = new Date('2026-07-30T12:00:00Z').getTime()

function conv(over: Partial<QueueItem> & { id: string }): QueueItem {
  return {
    contact_id: 'k-1',
    status: 'open',
    bot_paused: false,
    unread_count: 0,
    last_customer_message_at: null,
    last_bot_message_at: null,
    escalation_resolved: true,
    assigned_to: null,
    pause_reason: null,
    contact: { profile_name: 'Asha', channel: 'whatsapp', external_id: '9199' },
    ...over,
  }
}

describe('isUnanswered — who is actually waiting on us', () => {
  it('is true when the customer wrote after the bot last replied', () => {
    expect(
      isUnanswered(
        conv({
          id: 'c1',
          last_customer_message_at: T('2026-07-30T11:00:00Z'),
          last_bot_message_at: T('2026-07-30T10:00:00Z'),
        }),
      ),
    ).toBe(true)
  })

  it('is true when the customer wrote and the bot has never replied at all', () => {
    expect(
      isUnanswered(
        conv({ id: 'c2', last_customer_message_at: T('2026-07-30T11:00:00Z'), last_bot_message_at: null }),
      ),
    ).toBe(true)
  })

  it('is false when the bot has already replied after them', () => {
    expect(
      isUnanswered(
        conv({
          id: 'c3',
          last_customer_message_at: T('2026-07-30T10:00:00Z'),
          last_bot_message_at: T('2026-07-30T11:00:00Z'),
        }),
      ),
    ).toBe(false)
  })

  it('is false when the customer has never written — there is nothing to answer', () => {
    expect(isUnanswered(conv({ id: 'c4', last_customer_message_at: null }))).toBe(false)
  })
})

describe('waitingLongest — the spine of Today and Floor', () => {
  const items = [
    conv({ id: 'recent', last_customer_message_at: T('2026-07-30T11:55:00Z') }),
    conv({ id: 'oldest', last_customer_message_at: T('2026-07-29T08:00:00Z') }),
    conv({
      id: 'answered',
      last_customer_message_at: T('2026-07-28T08:00:00Z'),
      last_bot_message_at: T('2026-07-28T08:01:00Z'),
    }),
    conv({ id: 'middle', last_customer_message_at: T('2026-07-30T09:00:00Z') }),
  ]

  it('drops answered threads and orders the rest oldest-first', () => {
    expect(waitingLongest(items).map((c) => c.id)).toEqual(['oldest', 'middle', 'recent'])
  })

  it('puts the true oldest first, which is what Today leads with', () => {
    expect(waitingLongest(items)[0].id).toBe('oldest')
  })

  it('returns empty rather than throwing when nothing is waiting', () => {
    expect(waitingLongest([])).toEqual([])
  })
})

describe('unpickedEscalations — the engine’s definition, not a UI invention', () => {
  const items = [
    conv({ id: 'open-escalation', bot_paused: true, escalation_resolved: false, last_customer_message_at: T('2026-07-30T09:00:00Z') }),
    conv({ id: 'resolved', bot_paused: true, escalation_resolved: true }),
    conv({ id: 'running', bot_paused: false, escalation_resolved: false }),
    conv({ id: 'older-open', bot_paused: true, escalation_resolved: false, last_customer_message_at: T('2026-07-29T09:00:00Z') }),
  ]

  it('lists only paused-and-unresolved threads, longest wait first', () => {
    expect(unpickedEscalations(items).map((c) => c.id)).toEqual(['older-open', 'open-escalation'])
  })

  it('does not count a paused thread whose escalation was resolved', () => {
    expect(unpickedEscalations(items).map((c) => c.id)).not.toContain('resolved')
  })

  it('does not count an unresolved flag on a thread the bot is still running', () => {
    expect(unpickedEscalations(items).map((c) => c.id)).not.toContain('running')
  })
})

describe('pausedThreads — Health’s first question', () => {
  it('lists every paused thread regardless of whether the escalation was resolved', () => {
    const items = [
      conv({ id: 'p1', bot_paused: true, escalation_resolved: true }),
      conv({ id: 'p2', bot_paused: true, escalation_resolved: false }),
      conv({ id: 'live', bot_paused: false }),
    ]
    expect(pausedThreads(items).map((c) => c.id).sort()).toEqual(['p1', 'p2'])
  })
})

describe('dueToday / isOverdue — what belongs on Today', () => {
  it('includes anything due later today', () => {
    const out = dueToday([{ id: 'f1', due_at: T('2026-07-30T18:00:00Z') }], NOW)
    expect(out.map((f) => f.id)).toEqual(['f1'])
  })

  it('includes overdue items — they are more today than today is', () => {
    const out = dueToday([{ id: 'f2', due_at: T('2026-07-28T09:00:00Z') }], NOW)
    expect(out.map((f) => f.id)).toEqual(['f2'])
  })

  it('excludes anything due after today', () => {
    const out = dueToday([{ id: 'f3', due_at: T('2026-08-02T09:00:00Z') }], NOW)
    expect(out).toEqual([])
  })

  it('marks past due as overdue and future due as not', () => {
    expect(isOverdue(T('2026-07-30T09:00:00Z'), NOW)).toBe(true)
    expect(isOverdue(T('2026-07-30T18:00:00Z'), NOW)).toBe(false)
  })
})
