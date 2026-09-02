import { describe, expect, it } from 'vitest'
import { rankRebuttals } from './rebuttals'
import type { Rebuttal } from './contracts'

function row(over: Partial<Rebuttal> = {}): Rebuttal {
  return {
    taxonomy_id: 'tax-1',
    taxonomy_key: 'price',
    label: 'Too expensive',
    kind: 'objection',
    position: 0,
    icon: null,
    status: 'active',
    script_id: 'sc-1',
    script_version_id: 'sv-1',
    version: 1,
    created_at: '2026-08-01T00:00:00.000Z',
    headline: null,
    body: null,
    langs: ['en'],
    uses: 0,
    rated: 0,
    won: 0,
    spin: null,
    ...over,
  }
}

describe('rankRebuttals', () => {
  it('orders by won/uses descending', () => {
    const ranked = rankRebuttals([
      row({ taxonomy_key: 'weak', uses: 10, won: 5 }),   // 0.50
      row({ taxonomy_key: 'best', uses: 10, won: 8 }),   // 0.80
      row({ taxonomy_key: 'mid', uses: 100, won: 70 }),  // 0.70
    ])
    expect(ranked.map((r) => r.taxonomy_key)).toEqual(['best', 'mid', 'weak'])
  })

  it('sorts an untested rebuttal (uses === 0) LAST, not first', () => {
    const ranked = rankRebuttals([
      row({ taxonomy_key: 'untested', uses: 0, won: 0 }),
      row({ taxonomy_key: 'mediocre', uses: 4, won: 1 }), // 0.25
    ])
    expect(ranked.map((r) => r.taxonomy_key)).toEqual(['mediocre', 'untested'])
    const onlyUntested = rankRebuttals([
      row({ taxonomy_key: 'u1' }),
      row({ taxonomy_key: 'proven', uses: 3, won: 3 }), // 1.00
    ])
    expect(onlyUntested[onlyUntested.length - 1].taxonomy_key).toBe('u1')
  })

  it('breaks rate ties by uses descending — more evidence wins', () => {
    const ranked = rankRebuttals([
      row({ taxonomy_key: 'thin', uses: 10, won: 8 }),    // 0.80 over 10
      row({ taxonomy_key: 'solid', uses: 100, won: 80 }), // 0.80 over 100
    ])
    expect(ranked.map((r) => r.taxonomy_key)).toEqual(['solid', 'thin'])
  })

  it('never mutates the input rows', () => {
    const rows = [
      row({ taxonomy_key: 'b', uses: 2, won: 2 }),
      row({ taxonomy_key: 'a', uses: 9, won: 1 }),
    ]
    const snapshot = [...rows]
    rankRebuttals(rows)
    expect(rows).toEqual(snapshot)
  })
})
