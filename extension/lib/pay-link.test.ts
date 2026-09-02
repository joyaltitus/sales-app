import { describe, expect, it } from 'vitest'
import { buildUpiIntent, callbackWhen, canCollect, payVars, tokenAmount } from './pay-link'
import type { CourseItem, SalesConfig } from './contracts'

const config: SalesConfig = {
  languages: ['en', 'mn'],
  default_lang: 'en',
  upi_vpa: 'bright@okhdfcbank',
  upi_payee: 'Bright Academy',
  pay_url: 'https://pay.brightacademy.in/seat',
  token_amount: 2000,
  token_note: 'Seat token',
}

const course: CourseItem = {
  id: 'i-1', name: 'Bootcamp', category: null, active: true,
  sales_facts: { token_amount: 5000 },
}

describe('tokenAmount', () => {
  it('prefers the course amount over the workspace default', () => {
    expect(tokenAmount(config, course)).toBe(5000)
    expect(tokenAmount(config, null)).toBe(2000)
    expect(tokenAmount(null, null)).toBeNull()
  })
})

describe('payVars', () => {
  it('emits the tappable link and the UPI id as text', () => {
    const vars = payVars(config, null)
    expect(vars['pay.amount']).toBe('₹2,000')
    expect(vars['pay.upi']).toBe('bright@okhdfcbank')
    expect(vars['pay.url']).toBe('https://pay.brightacademy.in/seat')
  })
  it('omits what the workspace has not set', () => {
    expect(payVars({ upi_vpa: 'x@y' }, null)).toEqual({ 'pay.upi': 'x@y' })
  })
})

describe('canCollect', () => {
  it('needs a UPI id or a pay page', () => {
    expect(canCollect(config)).toBe(true)
    expect(canCollect({ pay_url: 'https://x' })).toBe(true)
    expect(canCollect({ languages: ['en'] })).toBe(false)
    expect(canCollect(null)).toBe(false)
  })
})

describe('buildUpiIntent', () => {
  it('builds pa/pn/am/cu/tn in order, percent-encoded', () => {
    expect(buildUpiIntent(config, 5000, 'Seat token')).toBe(
      'upi://pay?pa=bright%40okhdfcbank&pn=Bright%20Academy&am=5000&cu=INR&tn=Seat%20token',
    )
  })
  it('never writes + for a space', () => {
    expect(buildUpiIntent(config, null, 'a b')).not.toContain('+')
  })
  it('is null without a UPI id — a pay page is not an intent', () => {
    expect(buildUpiIntent({ pay_url: 'https://x' }, 100, null)).toBeNull()
  })
})

describe('callbackWhen', () => {
  const now = new Date('2026-09-02T06:00:00.000Z') // 11:30 am IST, Wednesday

  it('says "today" and "tomorrow" in the client timezone', () => {
    expect(callbackWhen('2026-09-02T11:30:00.000Z', 'Asia/Kolkata', now)).toBe('today 5:00 pm')
    expect(callbackWhen('2026-09-03T11:30:00.000Z', 'Asia/Kolkata', now)).toBe('tomorrow 5:00 pm')
  })

  it('names the weekday further out', () => {
    expect(callbackWhen('2026-09-04T10:30:00.000Z', 'Asia/Kolkata', now)).toBe('Fri 4:00 pm')
  })

  it('reads the clock in the client timezone, not the laptop one', () => {
    expect(callbackWhen('2026-09-03T11:30:00.000Z', 'UTC', now)).toBe('tomorrow 11:30 am')
  })

  it('is null when there is no usable time — never insert a text with a blank', () => {
    expect(callbackWhen(null)).toBeNull()
    expect(callbackWhen('not a date')).toBeNull()
  })
})
