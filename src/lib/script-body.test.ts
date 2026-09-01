import { describe, expect, it } from 'vitest'
import {
  buildMergeVars,
  findTokens,
  parseAuthoring,
  renderMerged,
  resolveParagraphs,
  toAuthoring,
  variantLangs,
} from './script-body'
import type { ScriptBody } from './script-body'

describe('parseAuthoring', () => {
  it('splits on blank lines and lifts the first **bold** into highlight', () => {
    expect(parseAuthoring('Hello there.\n\nFee is **₹85,000** total.')).toEqual([
      { before: 'Hello there.' },
      { before: 'Fee is ', highlight: '₹85,000', after: ' total.' },
    ])
  })

  // ★ edge case: a manager mid-sentence has unbalanced ** most of the time.
  it('leaves unbalanced ** literal instead of eating the rest of the script', () => {
    expect(parseAuthoring('Fee is **85,000 and the batch starts Monday.')).toEqual([
      { before: 'Fee is **85,000 and the batch starts Monday.' },
    ])
  })

  it('keeps a second ** pair literal — one highlight per paragraph', () => {
    expect(parseAuthoring('a **one** b **two** c')).toEqual([
      { before: 'a ', highlight: 'one', after: ' b **two** c' },
    ])
  })

  it('treats **** as literal rather than an empty highlight', () => {
    expect(parseAuthoring('nothing **** here')).toEqual([{ before: 'nothing **** here' }])
  })

  // ★ edge case: CRLF from a Windows paste, and runs of blank lines.
  it('normalises CRLF and drops empty paragraphs', () => {
    expect(parseAuthoring('one\r\n\r\n\r\n  \r\n\r\ntwo')).toEqual([{ before: 'one' }, { before: 'two' }])
  })

  it('never throws on empty or whitespace-only input', () => {
    expect(parseAuthoring('')).toEqual([])
    expect(parseAuthoring('   \n\n  ')).toEqual([])
  })
})

describe('toAuthoring', () => {
  it('round-trips anything parseAuthoring produced', () => {
    const text = 'Opening line.\n\nFee is **₹85,000** total.\n\nClosing **note** here **and** more.'
    const parsed = parseAuthoring(text)
    expect(parseAuthoring(toAuthoring(parsed))).toEqual(parsed)
  })

  it('handles a null paragraph list', () => {
    expect(toAuthoring(null)).toBe('')
  })
})

describe('resolveParagraphs', () => {
  const body: ScriptBody = {
    paragraphs: [{ before: 'English' }],
    lang: 'en',
    variants: { mn: { paragraphs: [{ before: 'Manglish' }] } },
  }

  it('returns the requested variant without flagging a fallback', () => {
    expect(resolveParagraphs(body, 'mn')).toEqual({ paragraphs: [{ before: 'Manglish' }], fallback: false })
  })

  it('falls back to the base body and flags it when the dialect is missing', () => {
    expect(resolveParagraphs(body, 'hi')).toEqual({ paragraphs: [{ before: 'English' }], fallback: true })
  })

  // ★ edge case: pre-068 rows have no lang and no variants and are live today.
  it('falls back and flags a pre-068 body that has no variants at all', () => {
    const legacy = { paragraphs: [{ before: 'Only ever English' }] } as ScriptBody
    expect(resolveParagraphs(legacy, 'mn')).toEqual({ paragraphs: [{ before: 'Only ever English' }], fallback: true })
    // ...but asking for the language it IS written in is not a fallback.
    expect(resolveParagraphs(legacy, 'en').fallback).toBe(false)
  })

  it('never blanks on a null body', () => {
    expect(resolveParagraphs(null, 'en')).toEqual({ paragraphs: [], fallback: false })
  })

  it('ignores a variant key that exists but is empty', () => {
    const empty: ScriptBody = { paragraphs: [{ before: 'English' }], lang: 'en', variants: { mn: { paragraphs: [] } } }
    expect(resolveParagraphs(empty, 'mn').fallback).toBe(true)
  })
})

describe('variantLangs', () => {
  it('lists the base language first, then the variant keys', () => {
    const body: ScriptBody = {
      paragraphs: [],
      lang: 'en',
      variants: { mn: { paragraphs: [] }, hi: { paragraphs: [] } },
    }
    expect(variantLangs(body)).toEqual(['en', 'hi', 'mn'])
  })

  it('defaults a pre-068 body to English only', () => {
    expect(variantLangs({ paragraphs: [] })).toEqual(['en'])
    expect(variantLangs(null)).toEqual([])
  })
})

describe('renderMerged', () => {
  it('substitutes known tokens and keeps the highlight structure', () => {
    const merged = renderMerged([{ before: 'Hi {{name}}, ', highlight: '₹{{course.fee}}', after: ' total.' }], {
      name: 'Anjali',
      'course.fee': 85000,
    })
    expect(merged).toEqual([{ before: 'Hi Anjali, ', highlight: '₹85000', after: ' total.' }])
  })

  it('leaves an unknown token visible verbatim, never blank', () => {
    expect(renderMerged([{ before: 'Starts {{course.batch_start}}.' }], {})).toEqual([
      { before: 'Starts {{course.batch_start}}.' },
    ])
  })

  it('renders a known-but-null token as empty rather than dropping the paragraph', () => {
    expect(renderMerged([{ before: 'Hi {{name}}!' }], { name: null })).toEqual([{ before: 'Hi !' }])
  })
})

describe('findTokens', () => {
  it('collects tokens from the base body and every variant, de-duplicated', () => {
    const body: ScriptBody = {
      paragraphs: [{ before: 'Hi {{name}} — ', highlight: '{{course.fee}}', after: ' {{pay.url}}' }],
      lang: 'en',
      variants: { mn: { paragraphs: [{ before: '{{name}} {{course.usp}}' }] } },
    }
    expect(findTokens(body)).toEqual(['name', 'course.fee', 'pay.url', 'course.usp'])
  })

  it('returns nothing for a null body', () => {
    expect(findTokens(null)).toEqual([])
  })
})

describe('buildMergeVars', () => {
  it('maps course facts onto the {{course.*}} token names', () => {
    const vars = buildMergeVars({
      contactName: 'Anjali',
      clientName: 'Vidya Sagar Academy',
      course: { name: 'NEET Repeater 2027', facts: { fee: 85000, emi_monthly: 7100, emi_months: 12 } },
      salesConfig: { tokenAmount: 500, payUrl: 'https://pay.invalid/x', upiVpa: 'vidyasagar@ybl' },
    })
    expect(vars['course.emi']).toBe(7100)
    expect(vars['course.fee']).toBe(85000)
    expect(vars['pay.amount']).toBe(500)
    expect(vars['pay.upi']).toBe('vidyasagar@ybl')
  })

  // ★ edge case: a missing fact key must stay ABSENT so the token renders
  // visibly rather than as an empty string the manager never notices.
  it('omits keys with no value so the token stays visible in the preview', () => {
    const vars = buildMergeVars({ course: { name: 'X', facts: { fee: 85000 } } })
    expect('course.usp' in vars).toBe(false)
    expect(renderMerged([{ before: '{{course.usp}}' }], vars)).toEqual([{ before: '{{course.usp}}' }])
  })

  it('falls back to the course token amount when the tenant has not set one', () => {
    expect(buildMergeVars({ course: { name: 'X', facts: { token_amount: 500 } } })['pay.amount']).toBe(500)
  })

  it('returns an empty map when called with nothing', () => {
    expect(buildMergeVars()).toEqual({})
  })
})
