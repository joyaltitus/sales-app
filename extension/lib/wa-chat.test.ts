import { describe, expect, it } from 'vitest'
import {
  matchChat,
  noteFromMessages,
  parseChat,
  parsePrePlainText,
  type ChatMessage,
} from './wa-chat'

const leads = [
  { display_name: 'Anjali Rao', phone_e164: '+919876543210' },
  { display_name: 'Vikram Shah', phone_e164: '+919000000001' },
  { display_name: 'Priya', phone_e164: null },
]

describe('parseChat', () => {
  it('reads a SAVED contact: name in the header, phone from the jid', () => {
    expect(parseChat({ title: 'Anjali Rao', jid: '919876543210@c.us' })).toEqual({
      displayName: 'Anjali Rao',
      phoneE164: '+919876543210',
    })
  })

  it('reads an UNSAVED number, where the header title IS the number', () => {
    expect(parseChat({ title: '+91 98765 43210', jid: '919876543210@c.us' })).toEqual({
      displayName: '+91 98765 43210',
      phoneE164: '+919876543210',
    })
  })

  it('falls back to the title for the phone when no message row carries a jid', () => {
    expect(parseChat({ title: '+91 98765 43210', jid: null })).toEqual({
      displayName: '+91 98765 43210',
      phoneE164: '+919876543210',
    })
  })

  it('keeps a NAME-ONLY chat followable, with no phone invented', () => {
    expect(parseChat({ title: 'Anjali Rao', jid: null })).toEqual({
      displayName: 'Anjali Rao',
      phoneE164: null,
    })
  })

  it('never reads digits inside a name as a phone number', () => {
    expect(parseChat({ title: 'Anjali 2nd batch', jid: null })).toEqual({
      displayName: 'Anjali 2nd batch',
      phoneE164: null,
    })
  })

  it('IGNORES a group chat entirely', () => {
    expect(parseChat({ title: 'Batch 4 — Parents', jid: '120363042@g.us' })).toBeNull()
  })

  it('ignores broadcast lists and channels for the same reason', () => {
    expect(parseChat({ title: 'Announcements', jid: 'status@broadcast' })).toBeNull()
    expect(parseChat({ title: 'Updates', jid: '12345@newsletter' })).toBeNull()
  })

  it('returns null when no chat is open', () => {
    expect(parseChat({ title: null, jid: null })).toBeNull()
    expect(parseChat({ title: '   ', jid: '' })).toBeNull()
  })
})

describe('matchChat', () => {
  it('matches on phone first, across +91 / 91 / bare-10-digit spellings', () => {
    for (const phone of ['+919876543210', '+919876543210', '+9876543210']) {
      const result = matchChat({ displayName: 'Whoever', phoneE164: phone }, leads)
      expect(result.how).toBe('phone')
      expect(result.lead?.display_name).toBe('Anjali Rao')
    }
  })

  it('prefers the phone over a name that points somewhere else', () => {
    const result = matchChat({ displayName: 'Vikram Shah', phoneE164: '+919876543210' }, leads)
    expect(result).toEqual({ lead: leads[0], how: 'phone' })
  })

  it('matches an exact name when there is no phone', () => {
    const result = matchChat({ displayName: 'priya', phoneE164: null }, leads)
    expect(result).toEqual({ lead: leads[2], how: 'name' })
  })

  it('matches a name loosely when exactly one lead contains it', () => {
    const result = matchChat({ displayName: 'Anjali', phoneE164: null }, leads)
    expect(result).toEqual({ lead: leads[0], how: 'search' })
  })

  it('refuses an AMBIGUOUS loose name rather than opening the wrong lead', () => {
    const ambiguous = [
      { display_name: 'Anjali Rao', phone_e164: null },
      { display_name: 'Anjali Mehta', phone_e164: null },
    ]
    expect(matchChat({ displayName: 'Anjali', phoneE164: null }, ambiguous)).toEqual({
      lead: null,
      how: 'none',
    })
  })

  it('reports no match for an unknown number', () => {
    expect(matchChat({ displayName: '+91 555 000 111', phoneE164: '+91555000111' }, leads)).toEqual({
      lead: null,
      how: 'none',
    })
  })

  it('reports no match against an empty book', () => {
    expect(matchChat({ displayName: 'Anjali Rao', phoneE164: '+919876543210' }, [])).toEqual({
      lead: null,
      how: 'none',
    })
  })
})

describe('parsePrePlainText', () => {
  it('splits WhatsApp’s own stamp into time and author', () => {
    expect(parsePrePlainText('[8:42 pm, 02/09/2026] Anjali Rao: ')).toEqual({
      at: '8:42 pm, 02/09/2026',
      author: 'Anjali Rao',
    })
  })

  it('tolerates a missing or unrecognised attribute instead of throwing', () => {
    expect(parsePrePlainText(null)).toEqual({ at: null, author: null })
    expect(parsePrePlainText('nonsense')).toEqual({ at: null, author: null })
  })
})

describe('noteFromMessages', () => {
  const messages: ChatMessage[] = [
    { id: '1', direction: 'in', text: 'Is the course still open?', voice: null, at: '8:42 pm, 02/09/2026', author: 'Anjali Rao' },
    { id: '2', direction: 'out', text: 'Yes, Monday batch.', voice: null, at: '8:44 pm, 02/09/2026', author: 'You' },
    { id: '3', direction: 'in', text: '', voice: '0:42', at: '8:45 pm, 02/09/2026', author: 'Anjali Rao' },
  ]

  it('writes the range, the count and every line the rep saw', () => {
    expect(noteFromMessages(messages, 'Anjali Rao')).toBe(
      [
        'WhatsApp chat with Anjali Rao — 8:42 pm, 02/09/2026 → 8:45 pm, 02/09/2026 (3 messages)',
        'Saved from WhatsApp Web by the rep.',
        '',
        '← Is the course still open?',
        '→ Yes, Monday batch.',
        '← [voice note, 0:42]',
      ].join('\n'),
    )
  })

  it('collapses the range when one message is selected', () => {
    expect(noteFromMessages([messages[0] as ChatMessage], 'Anjali Rao')).toContain(
      '— 8:42 pm, 02/09/2026 (1 message)',
    )
  })

  it('omits the range when WhatsApp gave us no stamps', () => {
    const undated = messages.map((message) => ({ ...message, at: null }))
    expect(noteFromMessages(undated, 'Anjali Rao')).toContain('WhatsApp chat with Anjali Rao (3 messages)')
  })
})
