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
