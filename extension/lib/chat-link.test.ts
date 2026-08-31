import { describe, expect, it } from 'vitest'
import { chatLink } from './chat-link'

describe('chatLink', () => {
  it("mode 'wa_me' builds a direct WhatsApp Web URL", () => {
    expect(chatLink('+919876543210', 'wa_me')).toBe('https://web.whatsapp.com/send?phone=919876543210')
    expect(chatLink('9876543210', 'wa_me')).toBe('https://web.whatsapp.com/send?phone=919876543210')
  })

  it("mode 'desktop' builds whatsapp://send?phone=<digits>", () => {
    expect(chatLink('+919876543210', 'desktop')).toBe('whatsapp://send?phone=919876543210')
    expect(chatLink('9876543210', 'desktop')).toBe('whatsapp://send?phone=919876543210')
  })

  it('emits digits only — no +, spaces or dashes survive', () => {
    for (const mode of ['wa_me', 'desktop'] as const) {
      const url = chatLink('+91 98765-43210', mode)!
      expect(url).not.toMatch(/[+\s-]/)
      expect(url.endsWith('919876543210')).toBe(true)
    }
  })

  it('returns null — never a broken URL — for null or unparseable numbers', () => {
    expect(chatLink(null, 'wa_me')).toBeNull()
    expect(chatLink(null, 'desktop')).toBeNull()
    expect(chatLink(undefined, 'wa_me')).toBeNull()
    expect(chatLink('', 'desktop')).toBeNull()
    expect(chatLink('not-a-phone', 'wa_me')).toBeNull()
  })
})
