import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { WaTemplate } from '../../lib/outbound-data'

// The send-template fallback. Everything the composer normally needs is stubbed
// out; what is under test is the gate (does it appear only when the window is
// shut?) and the handoff (does picking a template write exactly one row?).

const APPROVED: WaTemplate = {
  id: 't1', template_name: 'seat_reminder', language: 'en', category: 'utility',
  body_preview: 'Your seat is held.', variables: [], meta_status: 'approved', active: true,
}
const PENDING: WaTemplate = { ...APPROVED, id: 't2', template_name: 'not_yet', meta_status: 'pending' }

const { sendTemplateNow } = vi.hoisted(() => ({ sendTemplateNow: vi.fn() }))

vi.mock('../../lib/api', () => ({ sendAgentMessage: vi.fn() }))
vi.mock('../../lib/gateway-key', () => ({
  loadGatewayKey: () => 'a-key',
  hasConfiguredGatewayKey: () => true,
  clearGatewayKey: vi.fn(),
  saveGatewayKey: vi.fn(),
}))
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: function eq() { return { eq, order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }) } } }),
    }),
  },
}))
vi.mock('../../auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'user-1' } } }) }))
vi.mock('../../shell/ClientProvider', () => ({ useClient: () => ({ activeClient: { id: 'tenant-1' } }) }))
vi.mock('../objections/ObjectionCapture', () => ({ ObjectionCapture: () => null }))
vi.mock('../../ui/agent/VoiceButton', () => ({ VoiceButton: () => null }))
vi.mock('../../lib/outbound-data', async (orig) => ({
  ...(await orig<typeof import('../../lib/outbound-data')>()),
  useWaTemplates: () => ({ items: [APPROVED, PENDING], loading: false, error: null, reload: () => {} }),
  sendTemplateNow,
}))

const { Composer } = await import('./Composer')

function mount(windowClosed: boolean) {
  return render(
    <Composer
      conversationId="cv1"
      contactId="c1"
      canSend
      windowClosed={windowClosed}
      onSent={() => {}}
    />,
  )
}

beforeEach(() => {
  sendTemplateNow.mockReset()
  sendTemplateNow.mockResolvedValue({ ok: true })
})

describe('Composer send-template fallback', () => {
  it('stays out of the way while the reply window is open', () => {
    mount(false)
    expect(screen.queryByRole('button', { name: /send template/i })).not.toBeInTheDocument()
  })

  it('offers only templates Meta has approved once the window is shut', async () => {
    const user = userEvent.setup()
    mount(true)
    await user.click(screen.getByRole('button', { name: /send template/i }))
    expect(screen.getByText('seat_reminder')).toBeInTheDocument()
    // A pending template would be refused by pm_prepare_template_send, so it is
    // never offered — an option that always fails is worse than no option.
    expect(screen.queryByText('not_yet')).not.toBeInTheDocument()
  })

  it('queues one template send and says so instead of pretending it sent', async () => {
    const user = userEvent.setup()
    mount(true)
    await user.click(screen.getByRole('button', { name: /send template/i }))
    await user.click(screen.getByText('seat_reminder'))

    expect(sendTemplateNow).toHaveBeenCalledTimes(1)
    expect(sendTemplateNow.mock.calls[0][0]).toMatchObject({
      clientId: 'tenant-1',
      userId: 'user-1',
      contactId: 'c1',
      conversationId: 'cv1',
      params: [],
    })
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/queued/i))
  })

  it('shows the database refusal rather than a success message', async () => {
    sendTemplateNow.mockResolvedValue({ ok: false, code: 'write_failed', detail: 'denied' })
    const user = userEvent.setup()
    mount(true)
    await user.click(screen.getByRole('button', { name: /send template/i }))
    await user.click(screen.getByText('seat_reminder'))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('denied'))
  })
})
