import { describe, expect, it } from 'vitest'
import { CHANNELS, PHONE_PREFIX, hasDialableDigits, withPhonePrefix } from './lead-fields'

describe('hasDialableDigits', () => {
  it('rejects the bare prefix the form starts with', () => {
    // The whole reason this exists: `phone.trim()` calls '+91' valid, and
    // create_manual_lead would mint a contact whose identifier is '91'.
    expect(hasDialableDigits('+91')).toBe(false)
    expect(hasDialableDigits('91')).toBe(false)
    expect(hasDialableDigits(' +91 ')).toBe(false)
    expect(hasDialableDigits('')).toBe(false)
  })

  it('accepts the spellings an Indian rep actually types', () => {
    expect(hasDialableDigits('+919876543210')).toBe(true)
    expect(hasDialableDigits('9876543210')).toBe(true)
    expect(hasDialableDigits('+91 98765 43210')).toBe(true)
    expect(hasDialableDigits('09876543210')).toBe(true)
  })

  it('still rejects a half-typed number', () => {
    expect(hasDialableDigits('+9198')).toBe(false)
  })
})

describe('withPhonePrefix', () => {
  it('fills an empty field with +91 and leaves anything else alone', () => {
    expect(withPhonePrefix('')).toBe(PHONE_PREFIX)
    expect(withPhonePrefix('   ')).toBe(PHONE_PREFIX)
    expect(withPhonePrefix('+14155550100')).toBe('+14155550100')
  })
})

describe('CHANNELS', () => {
  it('is the one list both surfaces read', () => {
    expect(CHANNELS.map((channel) => channel.value)).toContain('whatsapp')
    expect(CHANNELS.map((channel) => channel.value)).toContain('walkin')
  })
})
