import { formatMoney } from './time'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { targetBar } from '../fixtures'
import { TargetBar } from './TargetBar'

describe('TargetBar', () => {
  it("renders the rep's own number compactly", () => {
    render(<TargetBar {...targetBar} />)
    const bar = screen.getByLabelText(/^Target for Joyal:/)
    expect(bar).toBeInTheDocument()
    expect(bar).toHaveTextContent(formatMoney(450000))
    expect(bar).toHaveTextContent(formatMoney(1200000))
    expect(bar).toHaveTextContent('38%')
  })

  it('shows incentive and bonus in the same compact format', () => {
    render(<TargetBar {...targetBar} />)
    expect(screen.getByText(`${formatMoney(2000)}/win`)).toBeInTheDocument()
    expect(screen.getByText(`+${formatMoney(15000)} at target`)).toBeInTheDocument()
  })

  it('caps progress at 100%', () => {
    render(<TargetBar {...targetBar} achieved_value={9000000} />)
    expect(screen.getByText('100%')).toBeInTheDocument()
  })
})
