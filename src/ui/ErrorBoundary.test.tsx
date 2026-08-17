import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary'
import { setErrorReporter } from '../lib/error-reporting'

function ProblemChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Test exploding component')
  }
  return <div>Healthy component content</div>
}

describe('ErrorBoundary', () => {
  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <ProblemChild shouldThrow={false} />
      </ErrorBoundary>,
    )

    expect(screen.getByText('Healthy component content')).toBeInTheDocument()
  })

  it('renders default fallback UI with Try again button when an error throws', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <ErrorBoundary>
        <ProblemChild shouldThrow={true} />
      </ErrorBoundary>,
    )

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Try again/i })).toBeInTheDocument()

    spy.mockRestore()
  })

  it('renders custom fallback function and recovers on reset', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    let throwError = true

    const { rerender } = render(
      <ErrorBoundary
        fallback={(err, reset) => (
          <div>
            <p>Custom: {err.message}</p>
            <button onClick={reset}>Recover</button>
          </div>
        )}
      >
        <ProblemChild shouldThrow={throwError} />
      </ErrorBoundary>,
    )

    expect(screen.getByText('Custom: Test exploding component')).toBeInTheDocument()

    // Fix component condition and trigger reset
    throwError = false
    rerender(
      <ErrorBoundary
        fallback={(err, reset) => (
          <div>
            <p>Custom: {err.message}</p>
            <button onClick={reset}>Recover</button>
          </div>
        )}
      >
        <ProblemChild shouldThrow={throwError} />
      </ErrorBoundary>,
    )

    await user.click(screen.getByRole('button', { name: 'Recover' }))
    expect(screen.getByText('Healthy component content')).toBeInTheDocument()

    spy.mockRestore()
  })

  it('reports caught errors and survives a failing reporter', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const capture = vi.fn(() => {
      throw new Error('reporter offline')
    })
    setErrorReporter({ capture })

    expect(() => render(
      <ErrorBoundary><ProblemChild shouldThrow /></ErrorBoundary>,
    )).not.toThrow()
    expect(capture).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Test exploding component' }),
      expect.objectContaining({ componentStack: expect.any(String) }),
    )
    expect(screen.getByRole('alert')).toBeInTheDocument()

    setErrorReporter(null)
    spy.mockRestore()
  })
})
