import { describe, expect, it } from 'vitest'
import { formatMoney } from './time'

describe('formatMoney', () => {
  it('renders zero as ₹0, never a dash', () => {
    expect(formatMoney(0)).toBe('₹0')
  })

  it('compacts thousands to K', () => {
    expect(formatMoney(2000)).toBe('₹2K')
    expect(formatMoney(15000)).toBe('₹15K')
    expect(formatMoney(60000)).toBe('₹60K')
  })

  it('compacts lakhs and crores', () => {
    expect(formatMoney(450000)).toBe('₹4.5L')
    expect(formatMoney(1200000)).toBe('₹12L')
    expect(formatMoney(12500000)).toBe('₹1.3Cr')
  })

  it('reads null/undefined as a dash, never ₹0', () => {
    expect(formatMoney(null)).toBe('—')
    expect(formatMoney(undefined)).toBe('—')
  })
})
