import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { sendAgentMessage, loadGatewayKey, hasConfiguredGatewayKey, clearGatewayKey, from } = vi.hoisted(() => ({
  sendAgentMessage: vi.fn(),
  loadGatewayKey: vi.fn(() => 'rejected-key'),
  hasConfiguredGatewayKey: vi.fn(() => false),
  clearGatewayKey: vi.fn(),
  from: vi.fn(),
}))

vi.mock('../../lib/api', () => ({ sendAgentMessage }))
vi.mock('../../lib/gateway-key', () => ({
  loadGatewayKey,
  hasConfiguredGatewayKey,
  clearGatewayKey,
  saveGatewayKey: vi.fn(),
}))
vi.mock('../../lib/supabase', () => ({ supabase: { from } }))
vi.mock('../../auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'user-1' } } }) }))
vi.mock('../../shell/ClientProvider', () => ({ useClient: () => ({ activeClient: { id: 'pixelledu' } }) }))
vi.mock('../objections/ObjectionCapture', () => ({ ObjectionCapture: () => null }))

const { Composer } = await import('./Composer')

describe('Composer authentication recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    loadGatewayKey.mockReturnValue('rejected-key')
    hasConfiguredGatewayKey.mockReturnValue(false)
    const limit = vi.fn().mockResolvedValue({ data: [], error: null })
    const order = vi.fn(() => ({ limit }))
    const eq = vi.fn(() => ({ eq, order }))
    from.mockReturnValue({ select: vi.fn(() => ({ eq })) })
  })

  it('lets the user replace a rejected workspace access key', async () => {
    const user = userEvent.setup()
    const limit = vi.fn().mockResolvedValue({ data: [], error: null })
    const order = vi.fn(() => ({ limit }))
    const eq = vi.fn(() => ({ eq, order }))
    from.mockReturnValue({ select: vi.fn(() => ({ eq })) })
    sendAgentMessage.mockResolvedValue({ kind: 'unauthorized' })

    render(
      <Composer
        conversationId="conversation-1"
        contactId="contact-1"
        canSend
        onSent={vi.fn()}
      />,
    )

    await user.type(screen.getByRole('textbox', { name: 'Type a reply' }), 'Hello')
    await user.click(screen.getByRole('button', { name: 'Send message' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/session or access key was rejected/i)
    expect(alert).toHaveAttribute('aria-live', 'assertive')
    await user.click(screen.getByRole('button', { name: 'Replace access key' }))
    expect(clearGatewayKey).toHaveBeenCalledTimes(1)
    expect(screen.getByText(/Paste your workspace access key once/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Paste your workspace access key once/i)).toHaveFocus()
  })

  it('keeps the key prompt hidden for authenticated employees with configured access', async () => {
    const limit = vi.fn().mockResolvedValue({ data: [], error: null })
    const order = vi.fn(() => ({ limit }))
    const eq = vi.fn(() => ({ eq, order }))
    from.mockReturnValue({ select: vi.fn(() => ({ eq })) })
    loadGatewayKey.mockReturnValue('configured-test-key')
    hasConfiguredGatewayKey.mockReturnValue(true)

    render(
      <Composer
        conversationId="conversation-1"
        contactId="contact-1"
        canSend
        onSent={vi.fn()}
      />,
    )

    expect(await screen.findByRole('textbox', { name: 'Type a reply' })).toBeInTheDocument()
    expect(screen.queryByText(/Paste your workspace access key once/i)).not.toBeInTheDocument()
  })

  it('directs every authenticated employee to an admin when configured access is rejected', async () => {
    const user = userEvent.setup()
    const limit = vi.fn().mockResolvedValue({ data: [], error: null })
    const order = vi.fn(() => ({ limit }))
    const eq = vi.fn(() => ({ eq, order }))
    from.mockReturnValue({ select: vi.fn(() => ({ eq })) })
    loadGatewayKey.mockReturnValue('configured-test-key')
    hasConfiguredGatewayKey.mockReturnValue(true)
    sendAgentMessage.mockResolvedValue({ kind: 'unauthorized' })

    render(
      <Composer
        conversationId="conversation-1"
        contactId="contact-1"
        canSend
        onSent={vi.fn()}
      />,
    )

    await user.type(screen.getByRole('textbox', { name: 'Type a reply' }), 'Hello')
    await user.click(screen.getByRole('button', { name: 'Send message' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/ask your admin to update the app configuration/i)
    expect(screen.queryByRole('button', { name: 'Replace access key' })).not.toBeInTheDocument()
    expect(clearGatewayKey).not.toHaveBeenCalled()
  })

  it('renders opt-out notice and disables composer when contact has opted out', async () => {
    render(
      <Composer
        conversationId="conversation-1"
        contactId="contact-1"
        canSend
        isOptedOut
        onSent={vi.fn()}
      />,
    )
    await act(async () => {})

    expect(
      screen.getByText('This contact has opted out of messages. Outbound replies are disabled.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Type a reply' })).not.toBeInTheDocument()
  })
})
