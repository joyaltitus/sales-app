import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MOCK_ROI, MOCK_SIGHTINGS } from '../preview/preview-mocks'

// Preview-prop render: no session, no network, no Supabase.
//
// The one thing worth pinning here is that a dash is NOT a zero. 070 returns
// NULL for cost-per-lead when there are no leads rather than dividing, and a
// campaign that spent ₹18,000 for nothing must never read as free.
vi.mock('../../lib/attribution-data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/attribution-data')>()
  return {
    ...actual,
    useCampaignRoi: () => ({ items: [], loading: false, error: null, reload: vi.fn() }),
    useSightings: () => ({ items: [], loading: false, error: null, reload: vi.fn() }),
  }
})

const { AttributionView } = await import('./AttributionView')

function rowFor(name: string): HTMLElement {
  const cell = screen.getByRole('rowheader', { name: new RegExp(name, 'i') })
  const row = cell.closest('tr')
  if (!row) throw new Error(`no row for ${name}`)
  return row
}

describe('AttributionView — a dash is not a zero', () => {
  it('renders an unknown cost per lead as a dash, never as ₹0', () => {
    render(<AttributionView designData={{ roi: MOCK_ROI, sightings: [] }} />)
    const cells = within(rowFor('Search')).getAllByRole('cell').map((c) => c.textContent)
    // spend, leads, won, revenue, cost/lead, cost/sale
    expect(cells[0]).toBe('₹18,000')
    expect(cells[4]).toBe('—')
    expect(cells[5]).toBe('—')
  })

  it('renders a known cost per lead in major units from a minor-unit row', () => {
    render(<AttributionView designData={{ roi: MOCK_ROI, sightings: [] }} />)
    const cells = within(rowFor('Onam')).getAllByRole('cell').map((c) => c.textContent)
    expect(cells[0]).toBe('₹42,000')
    expect(cells[3]).toBe('₹6,30,000')
    expect(cells[4]).toBe('₹438')
  })
})

describe('AttributionView — the unmatched-source inbox', () => {
  it('offers resolve and dismiss against the tenant’s campaigns', () => {
    render(<AttributionView designData={{ roi: MOCK_ROI, sightings: MOCK_SIGHTINGS }} />)
    expect(screen.getByText('120210000000999')).toBeInTheDocument()
    const picker = screen.getByLabelText(/campaign for 120210000000999/i)
    expect(within(picker).getByRole('option', { name: 'Onam 2026' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Resolve' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Not ours' })).toBeInTheDocument()
  })

  it('says plainly that resolving does not re-point past conversations', () => {
    // Nothing in the schema links a sighting to the conversations that produced
    // it, so the screen must not imply a retro-attribution it cannot perform.
    render(<AttributionView designData={{ roi: MOCK_ROI, sightings: MOCK_SIGHTINGS }} />)
    expect(screen.getByText(/to make future traffic land there too/i)).toBeInTheDocument()
  })
})
