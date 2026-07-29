// Wait time — the largest type on a queue row, larger than the customer's name
// (§1.5). This inverts every CRM ever built, deliberately: the name is *recall*,
// the wait is the *decision*. A rep scanning a queue is choosing who to answer
// next, and they choose on time.

/** Compact board stamp: 4m · 58m · 3h · 2d. Bounded to two characters plus a
 *  unit so the mono gutter never reflows. Tabular numerals are already global
 *  (src/index.css .tnum), so digits don't jitter as the clock ticks. */
export function waitStamp(since: string | null, now: number = Date.now()): string {
  if (!since) return '—'
  const ms = now - new Date(since).getTime()
  if (!Number.isFinite(ms) || ms < 0) return '—'

  const minutes = Math.floor(ms / 60_000)
  if (minutes < 1) return 'now'
  if (minutes < 60) return `${minutes}m`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`

  const days = Math.floor(hours / 24)
  return `${days}d`
}

export type Urgency = 'calm' | 'warm' | 'late'

/**
 * Urgency is expressed in WEIGHT and the neutral scale, not in colour — until it
 * crosses the danger threshold, at which point `danger` appears and means
 * something because it has been scarce (§1.7). This also survives sunlight and
 * colourblindness, which a colour-only urgency ramp does not.
 */
export function urgency(since: string | null, now: number = Date.now()): Urgency {
  if (!since) return 'calm'
  const minutes = (now - new Date(since).getTime()) / 60_000
  if (!Number.isFinite(minutes)) return 'calm'
  if (minutes >= 60) return 'late'
  if (minutes >= 15) return 'warm'
  return 'calm'
}

/** Clock time inside the thread, where the question is "when", not "how long". */
export function clockTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })
}
