const clock = new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })
const day = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' })

export function formatClock(iso: string): string {
  return Number.isFinite(Date.parse(iso)) ? clock.format(new Date(iso)) : ''
}

export function formatDay(iso: string): string {
  return Number.isFinite(Date.parse(iso)) ? day.format(new Date(iso)) : ''
}

export const STALE_AFTER_MS = 5 * 60 * 1000

/** Compact cache age: under an hour reads "8m", over reads "1h", over a day "2d". */
export function staleAgeLabel(ageMs: number): string {
  const minutes = Math.floor(ageMs / 60_000)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}
