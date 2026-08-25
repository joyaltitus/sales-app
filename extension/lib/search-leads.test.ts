import { describe, expect, it } from 'vitest'
import { searchLeads, type SearchableLead } from './search-leads'

const ASHA: SearchableLead = { display_name: 'Asha Menon', phone_e164: '+919876543210' }
const VIKRAM: SearchableLead = { display_name: 'Vikram Rao', phone_e164: '+919812345678' }
const BOOK = [ASHA, VIKRAM]

describe('searchLeads', () => {
  it.each([
    ['+919876543210'],
    ['919876543210'],
    ['09876543210'],
    ['9876543210'],
    ['98765 43210'],
  ])('matches contact by phone query %s', (query) => {
    const hits = searchLeads(BOOK, query)
    expect(hits).toHaveLength(1)
    expect(hits[0]).toBe(ASHA)
  })

  it('does not cross-match other numbers via suffix', () => {
    expect(searchLeads(BOOK, '9812345678').map((l) => l.display_name)).toEqual(['Vikram Rao'])
    expect(searchLeads(BOOK, '9999999999')).toEqual([])
  })

  it('matches a name query case-insensitively', () => {
    expect(searchLeads(BOOK, 'ASHA')).toEqual([ASHA])
    expect(searchLeads(BOOK, 'asha menon')).toEqual([ASHA])
    expect(searchLeads(BOOK, 'vikram RAO')).toEqual([VIKRAM])
  })

  it('matches a name query diacritic-insensitively', () => {
    const book = [{ display_name: 'José Alvarez', phone_e164: null }]
    expect(searchLeads(book, 'jose')).toHaveLength(1)
    expect(searchLeads(book, 'JOSE ALVAREZ')).toHaveLength(1)
    const anna = [{ display_name: 'Anne-Marie', phone_e164: null }]
    expect(searchLeads(anna, 'anne')).toHaveLength(1)
  })

  it('returns the input unchanged for an empty query — never an empty list', () => {
    expect(searchLeads(BOOK, '')).toBe(BOOK)
    expect(searchLeads(BOOK, '   ')).toBe(BOOK)
    expect(searchLeads([], '')).toEqual([])
  })

  it('never mutates the input array or its items', () => {
    const book = [ASHA, VIKRAM]
    searchLeads(book, 'asha')
    expect(book).toEqual([ASHA, VIKRAM])
  })
})
