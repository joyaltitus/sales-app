import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { from, session } = vi.hoisted(() => ({
  from: vi.fn(),
  session: { user: { id: 'user-1' } },
}))
vi.mock('../lib/supabase', () => ({ supabase: { from } }))
vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({ session }),
}))

const { ClientProvider, useClient } = await import('./ClientProvider')

const memberships = [
  { role: 'manager', clients: { id: 'demo', name: 'Demo', vertical: 'education' } },
  { role: 'manager', clients: { id: 'pixelledu', name: 'PixellEdu', vertical: 'education' } },
]

function Probe() {
  const { activeClient, setActiveClientId } = useClient()
  return (
    <div>
      <span>{activeClient?.name ?? 'none'}</span>
      <button onClick={() => setActiveClientId('pixelledu')}>Choose PixellEdu</button>
    </div>
  )
}

/** Reports the two things RoleRouter branches on. */
function StateProbe() {
  const { loading, failure, clients, reload } = useClient()
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="failure">{failure ?? 'none'}</span>
      <span data-testid="count">{clients.length}</span>
      <button onClick={reload}>Retry</button>
    </div>
  )
}

describe('workspace selection', () => {
  beforeEach(() => {
    localStorage.clear()
    from.mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: memberships, error: null }),
    })
  })

  it('keeps the selected tenant after the app reloads', async () => {
    const user = userEvent.setup()
    const first = render(<ClientProvider><Probe /></ClientProvider>)

    await screen.findByText('Demo')
    await user.click(screen.getByRole('button', { name: 'Choose PixellEdu' }))
    expect(screen.getByText('PixellEdu')).toBeInTheDocument()
    expect(localStorage.getItem('sales-app.activeClientId')).toBe('pixelledu')

    first.unmount()
    render(<ClientProvider><Probe /></ClientProvider>)
    await waitFor(() => expect(screen.getByText('PixellEdu')).toBeInTheDocument())
  })
})

// REG-031. Two distinct defects lived in the bare `.then(...)` this replaced:
// a rejection had nowhere to land, and a clean 401 was flattened into "no
// memberships" — which RoleRouter rendered as "your login isn't attached to a
// team", sending an operator to their admin over an expired token.
describe('membership read failures', () => {
  beforeEach(() => localStorage.clear())

  function respond(result: unknown, reject = false) {
    from.mockReturnValue({
      select: reject
        ? vi.fn().mockRejectedValue(result)
        : vi.fn().mockResolvedValue(result),
    })
  }

  it('stops loading when the read throws, instead of hanging on a blank screen', async () => {
    respond(new TypeError('Failed to fetch'), true)
    render(<ClientProvider><StateProbe /></ClientProvider>)

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'))
    expect(screen.getByTestId('failure')).toHaveTextContent('failed')
  })

  it.each([
    { code: 'PGRST301', message: 'JWT expired' },
    { code: '401', message: 'Unauthorized' },
    { message: 'invalid claim: missing sub claim' },
  ])('reads %o as an expired session, not as an empty membership list', async (error) => {
    respond({ data: null, error })
    render(<ClientProvider><StateProbe /></ClientProvider>)

    await waitFor(() => expect(screen.getByTestId('failure')).toHaveTextContent('expired'))
    expect(screen.getByTestId('loading')).toHaveTextContent('false')
  })

  it('keeps an ordinary error distinguishable from an expired token', async () => {
    respond({ data: null, error: { code: '500', message: 'upstream exploded' } })
    render(<ClientProvider><StateProbe /></ClientProvider>)

    await waitFor(() => expect(screen.getByTestId('failure')).toHaveTextContent('failed'))
  })

  it('reports no failure at all for a login that genuinely has no team', async () => {
    respond({ data: [], error: null })
    render(<ClientProvider><StateProbe /></ClientProvider>)

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'))
    expect(screen.getByTestId('failure')).toHaveTextContent('none')
    expect(screen.getByTestId('count')).toHaveTextContent('0')
  })

  it('re-runs the read on retry and clears the failure when it succeeds', async () => {
    const user = userEvent.setup()
    respond({ data: null, error: { code: 'PGRST301', message: 'JWT expired' } })
    render(<ClientProvider><StateProbe /></ClientProvider>)
    await waitFor(() => expect(screen.getByTestId('failure')).toHaveTextContent('expired'))

    respond({ data: memberships, error: null })
    await user.click(screen.getByRole('button', { name: 'Retry' }))

    await waitFor(() => expect(screen.getByTestId('failure')).toHaveTextContent('none'))
    expect(screen.getByTestId('count')).toHaveTextContent('2')
  })
})
