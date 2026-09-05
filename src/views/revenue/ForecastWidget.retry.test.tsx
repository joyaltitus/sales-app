import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ForecastWidget } from './ForecastWidget'

// REG-012. Three retry buttons across the app were wired to nothing —
// `() => undefined` here and in Playbook, `setPeriod(v => v)` (a React no-op)
// in the owner report. A dead Retry is worse than none: it reads as "I tried".
describe('ForecastWidget retry', () => {
  it('offers no retry when the caller has nothing to retry with', () => {
    render(<ForecastWidget metrics={null} />)

    expect(screen.getByText(/Couldn’t load the forecast/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument()
  })

  it('offers one, and calls it, when the screen that owns the read passes it', async () => {
    const onRetry = vi.fn()
    render(<ForecastWidget metrics={null} onRetry={onRetry} />)

    await userEvent.setup().click(screen.getByRole('button', { name: /retry/i }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
