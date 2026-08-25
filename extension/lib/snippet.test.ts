import { describe, expect, it } from 'vitest'
import { renderSnippet } from './snippet'

describe('renderSnippet', () => {
  it('substitutes {{name}} and other known tokens', () => {
    expect(renderSnippet('Hi {{name}}, about {{plan}}?', { name: 'Asha', plan: 'Pro' }))
      .toBe('Hi Asha, about Pro?')
  })

  it('leaves an unknown {{token}} visible verbatim — never blank, never an exception', () => {
    expect(renderSnippet('Hi {{name}} {{unknown_token}}', { name: 'Asha' }))
      .toBe('Hi Asha {{unknown_token}}')
    expect(renderSnippet('{{nope}}', {})).toBe('{{nope}}')
  })

  it('keeps the token verbatim when vars is empty', () => {
    expect(renderSnippet('Hello {{name}}', {})).toBe('Hello {{name}}')
  })

  it('tolerates inner whitespace around the key', () => {
    expect(renderSnippet('Hi {{ name }}', { name: 'Asha' })).toBe('Hi Asha')
    expect(renderSnippet('Hi {{  ghost  }}', { name: 'Asha' })).toBe('Hi {{  ghost  }}')
  })

  it('stringifies non-string values', () => {
    expect(renderSnippet('You owe {{amount}}', { amount: 499 })).toBe('You owe 499')
  })

  it('passes through bodies without tokens untouched', () => {
    expect(renderSnippet('No placeholders here', {})).toBe('No placeholders here')
  })
})
