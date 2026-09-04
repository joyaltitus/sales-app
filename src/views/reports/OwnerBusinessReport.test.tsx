import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MOCK_METRICS, MOCK_ROI } from '../preview/preview-mocks'
import OwnerBusinessReport from './OwnerBusinessReport'

// Rendered through the same `preview` door the /preview gallery uses — no
// session, no network. What is under test is the ARITHMETIC and the unit
// handling, because those are what turn a real tenant's numbers into a wrong
// story silently: the page still paints either way.

function renderReport() {
  return render(
    <OwnerBusinessReport designData={{ metrics: MOCK_METRICS, roi: MOCK_ROI, targetValue: 1_500_000 }} />,
  )
}

describe('Owner business report', () => {
  it('states revenue closed as a share of the month’s target', () => {
    renderReport()
    // 6,30,000 + 2,10,000 won across two sources.
    expect(screen.getByText('₹8.4L')).toBeInTheDocument()
    expect(screen.getByText('56% of ₹15L target this month')).toBeInTheDocument()
  })

  it('says there is no target rather than dividing by one nobody set', () => {
    render(<OwnerBusinessReport designData={{ metrics: MOCK_METRICS, roi: MOCK_ROI, targetValue: 0 }} />)
    expect(screen.getByText('No target set for this month')).toBeInTheDocument()
    expect(screen.queryByText(/% of ₹/)).not.toBeInTheDocument()
  })

  it('converts campaign money out of minor units exactly once', () => {
    renderReport()
    // 42,00,000 paise of spend is ₹42,000 — not ₹42,00,000, and not ₹420.
    expect(screen.getByText('₹42,000')).toBeInTheDocument()
    expect(screen.getByText('₹6,30,000')).toBeInTheDocument()
    expect(screen.queryByText('₹42,00,000')).not.toBeInTheDocument()
  })

  it('shows a dash, never ₹0, for a campaign that produced no sale', () => {
    renderReport()
    // Revenue of ₹0 is a fact and prints as ₹0. Cost per sale is the UNKNOWN —
    // 070 returns NULL rather than dividing by zero won deals — and a ₹0 there
    // would read as "this campaign sells for free".
    const cells = screen.getByRole('row', { name: /Search — always on/ }).querySelectorAll('td')
    expect(cells[cells.length - 1]).toHaveTextContent('—')
    expect(cells[cells.length - 1]).not.toHaveTextContent('₹')
  })

  it('draws no period-over-period comparison, because none is available', () => {
    renderReport()
    expect(screen.queryByText(/vs (prior|last)/i)).not.toBeInTheDocument()
    expect(screen.getByText(/no period-over-period comparison is available yet/i)).toBeInTheDocument()
  })

  it('says the readout is walled, not empty, when the role may not see revenue', () => {
    // hub-service answers a walled caller with null — NOT an empty array. ₹0
    // closed would report a permission wall as a bad month.
    render(
      <OwnerBusinessReport
        designData={{ metrics: { ...MOCK_METRICS, won_by_source: null }, roi: MOCK_ROI, targetValue: 1_500_000 }}
      />,
    )
    expect(screen.getByText('The business report is a manager view')).toBeInTheDocument()
    expect(screen.queryByText('Revenue closed')).not.toBeInTheDocument()
  })

  it('reports follow-up punctuality from the compliance split', () => {
    renderReport()
    // 94 on time of 100 completed.
    expect(screen.getByText('94% of follow-ups closed on time')).toBeInTheDocument()
  })
})
