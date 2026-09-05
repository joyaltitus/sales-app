import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// hub-service answers every refusal with `{ error: <code> }`, and that code is
// frequently the only thing separating two failures that share a status. The
// composer used to switch on the status alone, so window_closed, params_mismatch
// and opted_out — three different next actions for the rep — all rendered as one
// generic line.
const { sendAgentMessage, hasConfiguredGatewayKey, from } = vi.hoisted(() => ({
  sendAgentMessage: vi.fn(),
  hasConfiguredGatewayKey: vi.fn(() => true),
  from: vi.fn(),
}))

vi.mock('../../lib/api', () => ({ sendAgentMessage }))
vi.mock('../../lib/gateway-key', () => ({
  loadGatewayKey: vi.fn(() => 'configured-key'),
  hasConfiguredGatewayKey,
  clearGatewayKey: vi.fn(),
  saveGatewayKey: vi.fn(),
}))
vi.mock('../../lib/supabase', () => ({ supabase: { from } }))
vi.mock('../../auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'user-1' } } }) }))
vi.mock('../../shell/ClientProvider', () => ({ useClient: () => ({ activeClient: { id: 'pixelledu' } }) }))
vi.mock('../objections/ObjectionCapture', () => ({ ObjectionCapture: () => null }))

const { Composer } = await import('./Composer')

async function sendOnce() {
  const user = userEvent.setup()
  render(
    <Composer
      conversationId="conversation-1"
      contactId="contact-1"
      canSend
      onSent={vi.fn()}
      onOptimisticSend={() => 'temp-1'}
      onOptimisticSettle={vi.fn()}
    />,
  )
  await user.type(screen.getByRole('textbox', { name: 'Type a reply' }), 'Hello there')
  await user.click(screen.getByRole('button', { name: 'Send message' }))
  return screen.findByRole('alert')
}

describe('Composer refusal codes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    hasConfiguredGatewayKey.mockReturnValue(true)
    // The snippet picker reads quick_replies on mount. Without a chain here the
    // effect rejects, which vitest reports as an unhandled error even though
    // every assertion passes — the exact failure mode src/test/setup.ts warns
    // about.
    const limit = vi.fn().mockResolvedValue({ data: [], error: null })
    const order = vi.fn(() => ({ limit }))
    const eq = vi.fn(() => ({ eq, order }))
    from.mockReturnValue({ select: vi.fn(() => ({ eq })) })
  })

  it.each([
    ['bad_request', 'window_closed'],
    ['bad_request', 'params_mismatch'],
    ['bad_request', 'opted_out'],
    ['forbidden', 'not_assigned'],
    ['conflict', 'already_sent'],
  ])('shows the %s refusal code %s verbatim', async (kind, code) => {
    sendAgentMessage.mockResolvedValue({ kind, code })

    expect(await sendOnce()).toHaveTextContent(code)
  })

  it('keeps the plain-language gloss alongside the code', async () => {
    sendAgentMessage.mockResolvedValue({ kind: 'bad_request', code: 'window_closed' })

    const alert = await sendOnce()
    expect(alert).toHaveTextContent(/couldn't be sent as written/i)
    expect(alert).toHaveTextContent('window_closed')
  })

  it('says nothing extra when hub-service sent no code', async () => {
    sendAgentMessage.mockResolvedValue({ kind: 'unavailable' })

    const alert = await sendOnce()
    expect(alert).toHaveTextContent(/message service is unreachable/i)
    expect(alert.querySelector('.font-mono')).toBeNull()
  })
})
