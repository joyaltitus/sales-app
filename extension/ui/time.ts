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

const fullINR = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

function trimCompact(value: number, digits: number) {
  return value.toFixed(digits).replace(/\.0+$/, '')
}

/**
 * The ONE money format for the extension: compact Indian units.
 * 450000 → ₹4.5L, 15000 → ₹15K, 2000 → ₹2K, 500 → ₹500.
 * Null/undefined/NaN read as '—', never ₹0: a missing value is not zero.
 */
export function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  const safe = value
  const absolute = Math.abs(safe)
  const sign = safe < 0 ? '-' : ''

  if (absolute >= 1_00_00_000) return `${sign}₹${trimCompact(absolute / 1_00_00_000, 1)}Cr`
  if (absolute >= 1_00_000) return `${sign}₹${trimCompact(absolute / 1_00_000, 1)}L`
  if (absolute >= 1_000) return `${sign}₹${trimCompact(absolute / 1_000, 1)}K`
  return fullINR.format(safe)
}
