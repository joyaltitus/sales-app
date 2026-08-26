import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { rebuttals } from '../fixtures'
import { RebuttalList } from './RebuttalList'

describe('RebuttalList', () => {
  it('preserves the ranked order α2 produces', () => {
    render(<RebuttalList rebuttals={rebuttals} />)
    const list = screen.getByLabelText('Rebuttals ranked')
    const headlines = within(list).getAllByText(/Anchor|Booking now|decision-makers/)
    expect(headlines.map((el) => el.textContent)).toEqual([
      'Anchor on per-square-foot value, not total price',
      'Booking now locks the launch price',
      'Bring both decision-makers to one visit',
    ])
  })

  it('shows win-rate with uses for a tried rebuttal', () => {
    render(<RebuttalList rebuttals={rebuttals} />)
    expect(screen.getByText('42% won')).toBeInTheDocument()
    expect(screen.getByText('12 uses')).toBeInTheDocument()
  })

  it('reads a never-used rebuttal as "untested", not "0%"', () => {
    render(<RebuttalList rebuttals={rebuttals} />)
    expect(screen.getByText('untested')).toBeInTheDocument()
    expect(screen.queryByText(/0% won/)).not.toBeInTheDocument()
  })

  it('use click passes the rebuttal through', async () => {
    const onUse = vi.fn()
    render(<RebuttalList rebuttals={rebuttals} onUse={onUse} />)
    await userEvent.click(screen.getByText('Booking now locks the launch price'))
    expect(onUse).toHaveBeenCalledWith(rebuttals[1])
  })

  it('empty list shows an empty state', () => {
    render(<RebuttalList rebuttals={[]} />)
    expect(screen.getByText(/No rebuttals/)).toBeInTheDocument()
  })
})
