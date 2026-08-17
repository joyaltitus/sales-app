import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { sendAgentMessage, loadGatewayKey, hasConfiguredGatewayKey, from } = vi.hoisted(() => ({
  sendAgentMessage: vi.fn(),
  loadGatewayKey: vi.fn(() => 'configured-key'),
  hasConfiguredGatewayKey: vi.fn(() => true),
  from: vi.fn(),
}))

vi.mock('../../lib/api', () => ({ sendAgentMessage }))
vi.mock('../../lib/gateway-key', () => ({
  loadGatewayKey,
  hasConfiguredGatewayKey,
  clearGatewayKey: vi.fn(),
  saveGatewayKey: vi.fn(),
}))
vi.mock('../../lib/supabase', () => ({ supabase: { from } }))
vi.mock('../../auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'user-1' } } }) }))
vi.mock('../../shell/ClientProvider', () => ({ useClient: () => ({ activeClient: { id: 'pixelledu' } }) }))
vi.mock('../objections/ObjectionCapture', () => ({ ObjectionCapture: () => null }))
vi.mock('../../ui/agent/VoiceButton', () => ({ VoiceButton: () => null }))

const { Composer } = await import('./Composer')

/** A promise this test can resolve on demand, so "the bubble exists before
 *  the network call resolves" is provable without a wall-clock sleep. */
function deferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

describe('Composer optimistic bubble lifecycle (S1, issue #15)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    loadGatewayKey.mockReturnValue('configured-key')
    hasConfiguredGatewayKey.mockReturnValue(true)
    const limit = vi.fn().mockResolvedValue({ data: [], error: null })
    const order = vi.fn(() => ({ limit }))
    const eq = vi.fn(() => ({ eq, order }))
    from.mockReturnValue({ select: vi.fn(() => ({ eq })) })
  })

  it('paints the bubble and clears the input before the network call resolves', async () => {
    const user = userEvent.setup()
    const gate = deferred<{ kind: 'ok' }>()
    sendAgentMessage.mockReturnValue(gate.promise)
    const onOptimisticSend = vi.fn(() => 'optimistic:temp-1')
    const onOptimisticSettle = vi.fn()

    render(
      <Composer
        conversationId="conversation-1"
        contactId="contact-1"
        canSend
        onSent={vi.fn()}
        onOptimisticSend={onOptimisticSend}
        onOptimisticSettle={onOptimisticSettle}
      />,
    )

    const input = screen.getByRole('textbox', { name: 'Type a reply' })
    await user.type(input, 'Hello there')
    await user.click(screen.getByRole('button', { name: 'Send message' }))

    // Network call is still pending — bubble must already exist and the
    // input must already be clear.
    expect(onOptimisticSend).toHaveBeenCalledWith('Hello there')
    expect(onOptimisticSettle).not.toHaveBeenCalled()
    expect(input).toHaveValue('')

    gate.resolve({ kind: 'ok' })
    await screen.findByRole('button', { name: 'Send message' }) // settles back to idle-ish render
    expect(onOptimisticSettle).toHaveBeenCalledWith('optimistic:temp-1', true)
  })

  it('settles the bubble as failed on a hub-service error', async () => {
    const user = userEvent.setup()
    sendAgentMessage.mockResolvedValue({ kind: 'unauthorized' })
    const onOptimisticSend = vi.fn(() => 'optimistic:temp-2')
    const onOptimisticSettle = vi.fn()

    render(
      <Composer
        conversationId="conversation-1"
        contactId="contact-1"
        canSend
        onSent={vi.fn()}
        onOptimisticSend={onOptimisticSend}
        onOptimisticSettle={onOptimisticSettle}
      />,
    )

    await user.type(screen.getByRole('textbox', { name: 'Type a reply' }), 'Retry me')
    await user.click(screen.getByRole('button', { name: 'Send message' }))

    await screen.findByRole('alert')
    expect(onOptimisticSettle).toHaveBeenCalledWith('optimistic:temp-2', false)
  })

  it('settles the bubble as failed when no gateway key is configured, without ever calling the network', async () => {
    const user = userEvent.setup()
    loadGatewayKey.mockReturnValue('configured-key')
    hasConfiguredGatewayKey.mockReturnValue(true)
    sendAgentMessage.mockResolvedValue({ kind: 'no_key' })
    const onOptimisticSend = vi.fn(() => 'optimistic:temp-3')
    const onOptimisticSettle = vi.fn()

    render(
      <Composer
        conversationId="conversation-1"
        contactId="contact-1"
        canSend
        onSent={vi.fn()}
        onOptimisticSend={onOptimisticSend}
        onOptimisticSettle={onOptimisticSettle}
      />,
    )

    await user.type(screen.getByRole('textbox', { name: 'Type a reply' }), 'No key yet')
    await user.click(screen.getByRole('button', { name: 'Send message' }))

    await screen.findByText(/Paste your workspace access key once/i)
    expect(onOptimisticSettle).toHaveBeenCalledWith('optimistic:temp-3', false)
  })

  it('prompts before overwriting existing typed text with an AI draft (AT-05)', async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

    const { rerender } = render(
      <Composer
        conversationId="conversation-1"
        contactId="contact-1"
        canSend
        onSent={vi.fn()}
        seed={null}
      />,
    )

    const input = screen.getByRole('textbox', { name: 'Type a reply' })
    await user.type(input, 'My typed response')

    // Seed arrival when text is typed -> rejected by user
    rerender(
      <Composer
        conversationId="conversation-1"
        contactId="contact-1"
        canSend
        onSent={vi.fn()}
        seed={{ n: 1, text: 'AI generated draft' }}
      />,
    )

    expect(confirmSpy).toHaveBeenCalled()
    expect(input).toHaveValue('My typed response')

    // Now user accepts replacement
    confirmSpy.mockReturnValue(true)
    rerender(
      <Composer
        conversationId="conversation-1"
        contactId="contact-1"
        canSend
        onSent={vi.fn()}
        seed={{ n: 2, text: 'AI generated draft' }}
      />,
    )

    expect(input).toHaveValue('AI generated draft')
    confirmSpy.mockRestore()
  })

  it('applies the draft immediately without prompt when composer is empty (AT-05)', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm')

    const { rerender } = render(
      <Composer
        conversationId="conversation-1"
        contactId="contact-1"
        canSend
        onSent={vi.fn()}
        seed={null}
      />,
    )
    await act(async () => {})

    const input = screen.getByRole('textbox', { name: 'Type a reply' })
    expect(input).toHaveValue('')

    rerender(
      <Composer
        conversationId="conversation-1"
        contactId="contact-1"
        canSend
        onSent={vi.fn()}
        seed={{ n: 1, text: 'AI draft for empty composer' }}
      />,
    )

    expect(confirmSpy).not.toHaveBeenCalled()
    expect(input).toHaveValue('AI draft for empty composer')
    confirmSpy.mockRestore()
  })
})
