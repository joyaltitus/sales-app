import { describe, expect, it } from 'vitest'
import { formatINR, formatINRCompact } from './formatMoney'

describe('Indian money formatting', () => {
  it('uses Indian digit grouping in full readouts', () => {
    expect(formatINR(1_250_000)).toBe('₹12,50,000')
  })

  it('uses lakh and crore units in compact readouts', () => {
    expect(formatINRCompact(1_250_000)).toBe('₹12.5L')
    expect(formatINRCompact(12_000_000)).toBe('₹1.2Cr')
  })
})
