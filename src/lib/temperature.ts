import type { LeadItem, LeadStage } from './leads-data'

// Lead temperature — ported from Workbench src/lib/temperature.ts (the
// behaviour reference; SA-05). Pure derivation, no I/O, no Date.now() inside —
// callers pass `now` so lists derive consistently in one render pass.
//
//   override wins → lost = cold → won = hot → stale (>7d or never) = cold →
//   fresh (≤48h) AND (progressed past the first stage OR has a booking) = hot →
//   otherwise warm.

export type Temperature = 'hot' | 'warm' | 'cold'

export const HOT_ACTIVITY_MS = 48 * 3_600_000
export const COLD_ACTIVITY_MS = 7 * 24 * 3_600_000

export function deriveTemperature(args: {
  lastActivityAt: string | null
  progressed: boolean
  hasBooking: boolean
  status: string
  override: string | null
  now: number
}): { temp: Temperature; overridden: boolean } {
  const { lastActivityAt, progressed, hasBooking, status, override, now } = args
  if (override === 'hot' || override === 'warm' || override === 'cold') {
    return { temp: override, overridden: true }
  }
  if (status === 'lost') return { temp: 'cold', overridden: false }
  if (status === 'won') return { temp: 'hot', overridden: false }
  const age = lastActivityAt ? now - new Date(lastActivityAt).getTime() : Infinity
  if (age > COLD_ACTIVITY_MS) return { temp: 'cold', overridden: false }
  if (age <= HOT_ACTIVITY_MS && (progressed || hasBooking)) return { temp: 'hot', overridden: false }
  return { temp: 'warm', overridden: false }
}

/** `progressed` = the lead's stage is won, or sits past the FIRST non-won
 *  stage in sort order (Workbench's definition). */
export function stageProgressed(stageId: string, stages: LeadStage[]): boolean {
  const stage = stages.find((s) => s.id === stageId)
  if (!stage) return false
  if (stage.is_won) return true
  const firstOpen = Math.min(...stages.filter((s) => !s.is_won).map((s) => s.sort_order))
  return stage.sort_order > firstOpen
}

/** Convenience for board/drawer: derive for a LeadItem. `lastActivityAt` in
 *  sales-app is the lead's `updated_at` proxy unless the caller has the
 *  conversation recency (Today/Inbox reads carry it; the leads read does not). */
export function leadTemperature(
  lead: LeadItem,
  stages: LeadStage[],
  hasBooking: boolean,
  lastActivityAt: string | null,
  now: number,
): { temp: Temperature; overridden: boolean } {
  return deriveTemperature({
    lastActivityAt,
    progressed: stageProgressed(lead.stage_id, stages),
    hasBooking,
    status: lead.status,
    override: lead.temperature_override,
    now,
  })
}
