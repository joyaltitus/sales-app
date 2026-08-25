import { describe, expect, it } from 'vitest'
import type { QueueItem } from './contracts'
import { buildQueue, type FollowUpInput, type QueueLeadInput } from './queue'

const NOW = new Date('2026-08-25T10:00:00Z')

function lead(over: Partial<QueueLeadInput> = {}): QueueLeadInput {
  return {
    lead_id: 'lead-1',
    contact_id: 'contact-1',
    person_id: 'person-1',
    display_name: 'Asha',
    phone_e164: '+919876543210',
    channel: 'whatsapp',
    stage_key: 'qualified',
    stage_label: 'Qualified',
    status: 'open',
    owner: { user_id: 'user-1', display_name: 'Rep' },
    last_activity_at: '2026-08-20T09:00:00Z',
    ...over,
  }
}

function fu(over: Partial<FollowUpInput> = {}): FollowUpInput {
  return { id: 'fu-1', lead_id: 'lead-1', due_at: '2026-08-26T10:00:00Z', ...over }
}

describe('buildQueue', () => {
  it('merges due follow-ups with owned open leads into one QueueItem[]', () => {
    const items = buildQueue(
      [fu()],
      [
        lead(),
        lead({ lead_id: 'lead-2', contact_id: 'contact-2', display_name: 'Vikram' }),
      ],
      NOW,
    )
    expect(items).toHaveLength(2)
    const scheduled = items.find((i) => i.lead_id === 'lead-1')!
    expect(scheduled.reason).toBe('due')
    expect(scheduled.follow_up_id).toBe('fu-1')
    expect(scheduled.due_at).toBe('2026-08-26T10:00:00Z')
    const unscheduled = items.find((i) => i.lead_id === 'lead-2')!
    expect(unscheduled.follow_up_id).toBeNull()
    expect(unscheduled.due_at).toBeNull()
    // carried-through identity columns
    expect(scheduled.owner).toEqual({ user_id: 'user-1', display_name: 'Rep' })
    expect(scheduled.channel).toBe('whatsapp')
    expect(scheduled.status).toBe('open')
  })

  it('dedupes by lead_id — a followed-up lead appears exactly once, reason due or overdue', () => {
    const items = buildQueue(
      [fu({ id: 'fu-a', due_at: '2026-08-27T10:00:00Z' }), fu({ id: 'fu-b', due_at: '2026-08-24T10:00:00Z' })],
      [lead(), lead({ contact_id: 'contact-dup' })],
      NOW,
    )
    expect(items).toHaveLength(1)
    expect(items[0].follow_up_id).toBe('fu-b') // earliest due_at wins
    expect(['due', 'overdue']).toContain(items[0].reason)
  })

  it('marks a past-due follow-up overdue and an upcoming one due', () => {
    const items = buildQueue(
      [
        fu({ id: 'fu-past', lead_id: 'lead-past', due_at: '2026-08-25T09:59:59Z' }),
        fu({ id: 'fu-future', lead_id: 'lead-future', due_at: '2026-08-25T10:00:00Z' }),
      ],
      [lead({ lead_id: 'lead-past' }), lead({ lead_id: 'lead-future' })],
      NOW,
    )
    expect(items.find((i) => i.lead_id === 'lead-past')!.reason).toBe('overdue')
    expect(items.find((i) => i.lead_id === 'lead-future')!.reason).toBe('due')
  })

  it('orders overdue → due-today → new → idle', () => {
    const items = buildQueue(
      [
        fu({ id: 'fu-due', lead_id: 'lead-due', due_at: '2026-08-25T18:00:00Z' }),
        fu({ id: 'fu-over', lead_id: 'lead-over', due_at: '2026-08-24T18:00:00Z' }),
      ],
      [
        lead({ lead_id: 'lead-idle' }),
        lead({ lead_id: 'lead-new', last_activity_at: null }),
        lead({ lead_id: 'lead-due' }),
        lead({ lead_id: 'lead-over' }),
      ],
      NOW,
    )
    expect(items.map((i) => i.reason)).toEqual(['overdue', 'due', 'new', 'idle'])
  })

  it('earliest deadline sorts first inside a bucket', () => {
    const items = buildQueue(
      [
        fu({ id: 'fu-late', lead_id: 'lead-late', due_at: '2026-08-23T10:00:00Z' }),
        fu({ id: 'fu-early', lead_id: 'lead-early', due_at: '2026-08-22T10:00:00Z' }),
      ],
      [lead({ lead_id: 'lead-late' }), lead({ lead_id: 'lead-early' })],
      NOW,
    )
    expect(items.map((i) => i.lead_id)).toEqual(['lead-early', 'lead-late'])
  })

  it('is a stable sort for equal keys — equal-reason leads keep their input order', () => {
    const items = buildQueue(
      [],
      [
        lead({ lead_id: 'first-idle' }),
        lead({ lead_id: 'second-idle' }),
        lead({ lead_id: 'third-idle' }),
      ],
      NOW,
    )
    expect(items.map((i) => i.lead_id)).toEqual(['first-idle', 'second-idle', 'third-idle'])
  })

  it('classifies no activity as new and activity-without-schedule as idle', () => {
    const items = buildQueue(
      [],
      [lead({ lead_id: 'l-new', last_activity_at: null }), lead({ lead_id: 'l-idle' })],
      NOW,
    )
    expect(items.find((i) => i.lead_id === 'l-new')!.reason).toBe('new')
    expect(items.find((i) => i.lead_id === 'l-idle')!.reason).toBe('idle')
  })

  it('ignores follow-ups pointing at leads it was not given', () => {
    const items = buildQueue([fu({ lead_id: 'ghost' })], [lead()], NOW)
    expect(items).toHaveLength(1)
    expect(items[0].follow_up_id).toBeNull()
    expect(items[0].reason).toBe('idle')
  })

  it('never mutates its inputs', () => {
    const followUps = [fu()]
    const leads = [lead()]
    buildQueue(followUps, leads, NOW)
    expect(followUps).toEqual([fu()])
    expect(leads).toEqual([lead()])
  })

  it('returns QueueItems shaped per contracts', () => {
    const items: QueueItem[] = buildQueue([], [lead()], NOW)
    expect(Object.keys(items[0]).sort()).toEqual(
      [
        'channel', 'contact_id', 'display_name', 'due_at', 'follow_up_id',
        'last_activity_at', 'lead_id', 'owner', 'person_id', 'phone_e164',
        'reason', 'stage_key', 'stage_label', 'status',
      ].sort(),
    )
  })
})
