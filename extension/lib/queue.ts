/**
 * buildQueue — merge due follow-ups with owned open leads into one work queue.
 *
 * Pure: time enters as the `now` argument, nothing here reads a clock, touches
 * the network or knows about React or the host extension APIs.
 *
 * Reason semantics (v1):
 *   overdue — lead has a follow-up whose due_at is before `now`
 *   due     — lead has a follow-up scheduled at or after `now`
 *   new     — no follow-up and no recorded activity (last_activity_at null)
 *   idle    — no follow-up but activity exists; nothing scheduled
 */
import type { OwnerRef, QueueItem } from './contracts'

/** The lead columns the queue needs; callers select these from crm-data. */
export type QueueLeadInput = {
  lead_id: string
  contact_id: string
  person_id: string | null
  display_name: string
  phone_e164: string | null
  channel: QueueItem['channel']
  stage_key: string
  stage_label: string
  status: QueueItem['status']
  owner: OwnerRef | null
  last_activity_at: string | null
}

/** The follow-up columns the queue needs. */
export type FollowUpInput = {
  id: string
  lead_id: string
  due_at: string | null
}

const REASON_RANK: Record<QueueItem['reason'], number> = {
  overdue: 0,
  due: 1,
  new: 2,
  idle: 3,
}

function toMs(value: Date | number | string): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime()
}

/**
 * Merge follow-ups into leads and order the result:
 * overdue → due → new → idle. A lead appears exactly once, ever.
 */
export function buildQueue(
  followUps: readonly FollowUpInput[],
  leads: readonly QueueLeadInput[],
  now: Date | number | string,
): QueueItem[] {
  const nowMs = toMs(now)

  // Earliest non-null due_at wins if several follow-ups point at one lead;
  // ties keep the first encountered. Null-due follow-ups schedule nothing.
  // The original due_at STRING is carried through untouched — ms are for
  // comparison only, so output stays byte-faithful to the DB value.
  const scheduled = new Map<string, { id: string; dueMs: number; due_at: string }>()
  for (const fu of followUps) {
    if (!fu.due_at) continue
    const dueMs = toMs(fu.due_at)
    const existing = scheduled.get(fu.lead_id)
    if (!existing || dueMs < existing.dueMs) {
      scheduled.set(fu.lead_id, { id: fu.id, dueMs, due_at: fu.due_at })
    }
  }

  const seen = new Set<string>()
  const items: QueueItem[] = []
  for (const lead of leads) {
    if (seen.has(lead.lead_id)) continue
    seen.add(lead.lead_id)

    let reason: QueueItem['reason']
    let due_at: string | null = null
    let follow_up_id: string | null = null
    const booked = scheduled.get(lead.lead_id)
    if (booked) {
      reason = booked.dueMs < nowMs ? 'overdue' : 'due'
      due_at = booked.due_at
      follow_up_id = booked.id
    } else {
      reason = lead.last_activity_at === null ? 'new' : 'idle'
    }

    items.push({
      lead_id: lead.lead_id,
      contact_id: lead.contact_id,
      person_id: lead.person_id,
      display_name: lead.display_name,
      phone_e164: lead.phone_e164,
      channel: lead.channel,
      stage_key: lead.stage_key,
      stage_label: lead.stage_label,
      status: lead.status,
      owner: lead.owner,
      due_at,
      follow_up_id,
      last_activity_at: lead.last_activity_at,
      reason,
    })
  }

  // Array.prototype.sort is stable (ES2019+): items with equal reason AND
  // equal due_at keep input order. Inside a bucket, earliest deadline first.
  return items.sort((a, b) => {
    const byRank = REASON_RANK[a.reason] - REASON_RANK[b.reason]
    if (byRank !== 0) return byRank
    const aDue = a.due_at ? toMs(a.due_at) : Number.POSITIVE_INFINITY
    const bDue = b.due_at ? toMs(b.due_at) : Number.POSITIVE_INFINITY
    return aDue - bDue
  })
}
