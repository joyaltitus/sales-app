/**
 * rankRebuttals — order rebuttal candidates for the objection screen.
 *
 * Proven win-rate first. An untested rebuttal (uses === 0) sorts LAST — it
 * must never outrank a proven one just because a naive NaN comparison drops
 * it to the top. Ties on rate break by volume (uses desc).
 */
import type { Rebuttal } from './contracts'

function score(row: Rebuttal): number {
  // -1 sits below every real rate (rates live in [0, 1]).
  return row.uses > 0 ? row.won / row.uses : -1
}

export function rankRebuttals(rows: readonly Rebuttal[]): Rebuttal[] {
  return [...rows].sort((a, b) => {
    const byRate = score(b) - score(a)
    if (byRate !== 0) return byRate
    return b.uses - a.uses
  })
}
