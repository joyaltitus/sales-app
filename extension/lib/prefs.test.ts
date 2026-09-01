import { describe, expect, it } from 'vitest'
import { DEFAULT_PREFS, isQuietAt } from './prefs'

const at = (h: number, m = 0) => new Date(2026, 8, 2, h, m)

describe('isQuietAt', () => {
  it('mutes across the default overnight window', () => {
    expect(isQuietAt(DEFAULT_PREFS, at(22))).toBe(true)
    expect(isQuietAt(DEFAULT_PREFS, at(3))).toBe(true)
    expect(isQuietAt(DEFAULT_PREFS, at(8, 59))).toBe(true)
  })

  it('lets the working day through', () => {
    expect(isQuietAt(DEFAULT_PREFS, at(9))).toBe(false)
    expect(isQuietAt(DEFAULT_PREFS, at(14))).toBe(false)
    expect(isQuietAt(DEFAULT_PREFS, at(20, 59))).toBe(false)
  })

  it('handles a same-day window that does not cross midnight', () => {
    const midday = { quietFrom: '13:00', quietTo: '14:00' }
    expect(isQuietAt(midday, at(13, 30))).toBe(true)
    expect(isQuietAt(midday, at(12, 59))).toBe(false)
    expect(isQuietAt(midday, at(14))).toBe(false)
  })

  it('treats equal endpoints as NO quiet hours, never as all day', () => {
    expect(isQuietAt({ quietFrom: '09:00', quietTo: '09:00' }, at(9))).toBe(false)
    expect(isQuietAt({ quietFrom: '09:00', quietTo: '09:00' }, at(3))).toBe(false)
  })

  it('ignores an unparseable value rather than muting everything', () => {
    expect(isQuietAt({ quietFrom: 'evening', quietTo: '09:00' }, at(22))).toBe(false)
    expect(isQuietAt({ quietFrom: '25:00', quietTo: '09:00' }, at(22))).toBe(false)
  })
})
