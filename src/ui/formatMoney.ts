const fullINR = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

function trim(value: number, digits: number) {
  return value.toFixed(digits).replace(/\.0+$/, '')
}

/** Full Indian grouping for roomy readouts: 1250000 → ₹12,50,000. */
export function formatINR(value: number): string {
  return fullINR.format(Number.isFinite(value) ? value : 0)
}

/** Compact Indian units for dense cards: 1250000 → ₹12.5L. */
export function formatINRCompact(value: number): string {
  const safe = Number.isFinite(value) ? value : 0
  const absolute = Math.abs(safe)
  const sign = safe < 0 ? '-' : ''

  if (absolute >= 1_00_00_000) return `${sign}₹${trim(absolute / 1_00_00_000, 1)}Cr`
  if (absolute >= 1_00_000) return `${sign}₹${trim(absolute / 1_00_000, 1)}L`
  if (absolute >= 1_000) return `${sign}₹${trim(absolute / 1_000, 1)}K`
  return formatINR(safe)
}
