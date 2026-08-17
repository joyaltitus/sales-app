import { describe, expect, it } from 'vitest'
import { cleanPhoneForWhatsApp, formatPhone, getWhatsAppUrl } from './phone'

describe('phone utility', () => {
  describe('cleanPhoneForWhatsApp', () => {
    it('cleans 12-digit Indian numbers with country code', () => {
      expect(cleanPhoneForWhatsApp('919947638424')).toBe('919947638424')
      expect(cleanPhoneForWhatsApp('+91 99476-38424')).toBe('919947638424')
    })

    it('prefixes 10-digit Indian numbers with 91', () => {
      expect(cleanPhoneForWhatsApp('9947638424')).toBe('919947638424')
    })

    it('strips WhatsApp JID suffixes', () => {
      expect(cleanPhoneForWhatsApp('919947638424@c.us')).toBe('919947638424')
      expect(cleanPhoneForWhatsApp('919947638424@s.whatsapp.net')).toBe('919947638424')
    })

    it('handles empty or null inputs', () => {
      expect(cleanPhoneForWhatsApp('')).toBe('')
      expect(cleanPhoneForWhatsApp(null)).toBe('')
      expect(cleanPhoneForWhatsApp(undefined)).toBe('')
    })
  })

  describe('formatPhone', () => {
    it('formats Indian mobile numbers in 5+5 digit grouping', () => {
      expect(formatPhone('919947638424')).toBe('+91 99476 38424')
      expect(formatPhone('9947638424')).toBe('+91 99476 38424')
      expect(formatPhone('+91 9947638424')).toBe('+91 99476 38424')
    })

    it('preserves non-phone handles like Instagram usernames', () => {
      expect(formatPhone('rock.ey4973')).toBe('rock.ey4973')
      expect(formatPhone('@user123')).toBe('@user123')
    })
  })

  describe('getWhatsAppUrl', () => {
    it('generates valid wa.me URL', () => {
      expect(getWhatsAppUrl('919947638424')).toBe('https://wa.me/919947638424')
      expect(getWhatsAppUrl('9947638424')).toBe('https://wa.me/919947638424')
      expect(getWhatsAppUrl('919947638424', 'Hello Asha')).toBe('https://wa.me/919947638424?text=Hello%20Asha')
    })

    it('returns null for empty phone', () => {
      expect(getWhatsAppUrl(null)).toBeNull()
      expect(getWhatsAppUrl('')).toBeNull()
    })
  })
})
