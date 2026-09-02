import { describe, expect, it } from 'vitest'
import { bodyLangs, hookVariant, resolveParagraphs, toText } from './script-text'
import type { ScriptBody } from './contracts'

const body: ScriptBody = {
  lang: 'en',
  paragraphs: [{ before: 'The fee is ₹85,000. ', highlight: 'Most people start on the plan.', after: '' }],
  variants: {
    mn: { paragraphs: [{ before: 'Fee ₹85,000 aanu. ', highlight: 'Pattern plan aanu.', after: '' }] },
  },
}

describe('resolveParagraphs', () => {
  it('returns the variant when the dialect has one', () => {
    const result = resolveParagraphs(body, 'mn')
    expect(result.fallback).toBe(false)
    expect(result.lang).toBe('mn')
    expect(result.paragraphs[0].before).toContain('aanu')
  })

  // ★ B8: no variant for the chosen dialect → default paragraphs, flagged, never blank.
  it('falls back to the default body when the dialect is missing', () => {
    const result = resolveParagraphs(body, 'hi')
    expect(result.fallback).toBe(true)
    expect(result.lang).toBe('en')
    expect(toText(result.paragraphs)).not.toBe('')
  })

  it('does not fall back for the default dialect itself', () => {
    expect(resolveParagraphs(body, 'en').fallback).toBe(false)
  })

  it('treats an empty variant as missing rather than as a blank script', () => {
    const empty: ScriptBody = { ...body, variants: { hi: { paragraphs: [] } } }
    const result = resolveParagraphs(empty, 'hi')
    expect(result.fallback).toBe(true)
    expect(result.paragraphs).toHaveLength(1)
  })

  it('survives a null body', () => {
    expect(resolveParagraphs(null, 'mn')).toEqual({ paragraphs: [], fallback: false, lang: 'en' })
  })
})

describe('bodyLangs', () => {
  it('lists the default first, then variants, without duplicates', () => {
    expect(bodyLangs(body)).toEqual(['en', 'mn'])
    expect(bodyLangs({ ...body, variants: { en: { paragraphs: [] }, hi: { paragraphs: [] } } })).toEqual(['en', 'hi'])
    expect(bodyLangs(null)).toEqual([])
  })
})

describe('toText', () => {
  it('joins before + highlight + after, paragraphs blank-line separated', () => {
    expect(toText([
      { before: 'One. ', highlight: 'Two.' },
      { before: 'Three.' },
    ])).toBe('One. Two.\n\nThree.')
  })

  it('drops empty paragraphs instead of emitting stray blank lines', () => {
    expect(toText([{ before: '' }, { before: 'Real.' }])).toBe('Real.')
  })
})

describe('hookVariant', () => {
  it('inbound: a new lead that wrote to us', () => {
    expect(hookVariant({ reason: 'new', channel: 'whatsapp' }, [])).toBe('stage_hook_inbound')
  })

  it('cold: a new lead we are calling out of the blue', () => {
    expect(hookVariant({ reason: 'new', channel: 'phone' }, [])).toBe('stage_hook_cold')
  })

  it('follow-up: any prior call, or a due/overdue/idle reason', () => {
    expect(hookVariant({ reason: 'new', channel: 'phone' }, [{}])).toBe('stage_hook_followup')
    expect(hookVariant({ reason: 'due', channel: 'phone' }, [])).toBe('stage_hook_followup')
    expect(hookVariant({ reason: 'overdue', channel: 'whatsapp' }, [])).toBe('stage_hook_followup')
    expect(hookVariant({ reason: 'idle', channel: 'instagram' }, [])).toBe('stage_hook_followup')
  })
})
