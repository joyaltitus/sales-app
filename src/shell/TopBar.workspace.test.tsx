import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

const { mockUseClient, setActiveClientId } = vi.hoisted(() => ({
  mockUseClient: vi.fn(),
  setActiveClientId: vi.fn(),
}))

vi.mock('./ClientProvider', () => ({ useClient: mockUseClient }))
vi.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ signOut: vi.fn() }) }))
vi.mock('./theme', () => ({ useTheme: () => ({ theme: 'light', toggle: vi.fn() }) }))
vi.mock('../pwa/useOnline', () => ({ useOnline: () => true }))
vi.mock('../views/agent/AgentLauncher', () => ({ AgentLauncher: () => null }))
vi.mock('../ui/NotificationCenter', () => ({ NotificationCenter: () => null }))
vi.mock('../ui/ProductMark', () => ({ ProductMark: () => null }))
vi.mock('../ui/Sheet', () => ({ Sheet: () => null }))

const { TopBar } = await import('./TopBar')

describe('workspace switcher', () => {
  it('lets a multi-tenant user choose PixellEdu accessibly', async () => {
    const user = userEvent.setup()
    mockUseClient.mockReturnValue({
      clients: [
        { id: 'demo', name: 'Demo', vertical: 'education', role: 'manager' },
        { id: 'pixelledu', name: 'PixellEdu', vertical: 'education', role: 'manager' },
      ],
      activeClient: { id: 'demo', name: 'Demo', vertical: 'education', role: 'manager' },
      setActiveClientId,
      loading: false,
    })

    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><TopBar /></MemoryRouter>)
    const switcher = screen.getByRole('combobox', { name: 'Workspace' })
    await user.selectOptions(switcher, 'pixelledu')
    expect(setActiveClientId).toHaveBeenCalledWith('pixelledu')
  })

  it('does not show a switcher to a single-tenant user', () => {
    mockUseClient.mockReturnValue({
      clients: [{ id: 'demo', name: 'Demo', vertical: 'education', role: 'agent' }],
      activeClient: { id: 'demo', name: 'Demo', vertical: 'education', role: 'agent' },
      setActiveClientId,
      loading: false,
    })

    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><TopBar /></MemoryRouter>)
    expect(screen.queryByRole('combobox', { name: 'Workspace' })).not.toBeInTheDocument()
  })
})
