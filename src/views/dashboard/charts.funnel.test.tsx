import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Funnel } from './charts'

// REG-011. The step conversion divided by the previous stage with no guard, so
// a stage nobody reached produced NaN% or Infinity%, and a skipped stage let a
// later count exceed its predecessor — which is how this printed 333%.
describe('Funnel step conversion', () => {
  function pcts() {
    return [...document.querySelectorAll('span')]
      .map((s) => s.textContent ?? '')
      .filter((t) => t.endsWith('%'))
  }

  it('says nothing rather than NaN% when the previous stage is empty', () => {
    render(<Funnel stages={[{ label: 'New', count: 0 }, { label: 'Qualified', count: 0 }]} />)
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument()
    expect(pcts()).toEqual([])
  })

  it('says nothing rather than Infinity% when a stage was skipped', () => {
    render(<Funnel stages={[{ label: 'New', count: 0 }, { label: 'Won', count: 3 }]} />)
    expect(screen.queryByText(/Infinity/)).not.toBeInTheDocument()
    expect(pcts()).toEqual([])
  })

  it('never reports a conversion above 100%', () => {
    render(<Funnel stages={[{ label: 'New', count: 3 }, { label: 'Won', count: 10 }]} />)
    expect(screen.queryByText('333%')).not.toBeInTheDocument()
    expect(pcts()).toEqual(['100%'])
  })

  it('still reports an ordinary conversion', () => {
    render(<Funnel stages={[{ label: 'New', count: 10 }, { label: 'Qualified', count: 4 }]} />)
    expect(pcts()).toEqual(['40%'])
  })

  it('never shows a conversion against the first stage', () => {
    render(<Funnel stages={[{ label: 'New', count: 10 }]} />)
    expect(pcts()).toEqual([])
  })
})
