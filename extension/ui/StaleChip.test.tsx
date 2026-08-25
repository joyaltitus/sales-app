import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StaleChip } from './StaleChip'

const NOW = Date.parse('2026-08-25T12:00:00.000Z')

describe('StaleChip', () => {
  it('renders nothing for data fetched right now', () => {
    render(<StaleChip fetched_at="2026-08-25T12:00:00.000Z" now={NOW} />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('renders nothing under five minutes old', () => {
    render(<StaleChip fetched_at="2026-08-25T11:56:00.000Z" now={NOW} />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('renders an age label when older than five minutes', () => {
    render(<StaleChip fetched_at="2026-08-25T11:50:00.000Z" now={NOW} />)
    expect(screen.getByRole('status')).toHaveTextContent(/Cached 10m ago/)
  })

  it('labels hours-old cache', () => {
    render(<StaleChip fetched_at="2026-08-25T11:00:00.000Z" now={NOW} />)
    expect(screen.getByRole('status')).toHaveTextContent(/Cached 1h ago/)
  })

  it('labels a fetch an hour old via acceptance case', () => {
    const now = Date.now()
    render(<StaleChip fetched_at={new Date(now - 60 * 60 * 1000).toISOString()} now={now} />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})
