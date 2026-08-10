import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const PIXELLEDU_ID = 'cc4a7484-064e-495c-b611-b5ca105410f7'
const TARGET_CONVERSATION_ID = '6913f0f5-5e04-41a8-9808-bd755b372bfc'
const DEMO_REP_ID = '5c08a2c0-0cd1-4d93-b478-e89673064ad6'

const { clientState, authState, queueItems } = vi.hoisted(() => ({
  clientState: { role: 'manager' },
  authState: { userId: 'manager-id' },
  queueItems: [] as Array<Record<string, unknown>>,
}))

vi.mock('../../shell/ClientProvider', () => ({
  useClient: () => ({ activeClient: { id: PIXELLEDU_ID, name: 'PixellEdu', role: clientState.role } }),
}))
vi.mock('../../auth/AuthProvider', () => ({
  useAuth: () => ({ session: { user: { id: authState.userId } } }),
}))
vi.mock('../../lib/inbox-data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/inbox-data')>()
  return {
    ...actual,
    useQueue: () => ({ items: queueItems, loading: false, error: null, reload: vi.fn() }),
    usePreviews: () => ({ previews: new Map(), reload: vi.fn() }),
    useThread: () => ({ messages: [], traces: [], loading: false, error: null, reload: vi.fn(), setMessages: vi.fn() }),
    useLiveRefresh: () => ({ channelLive: false }),
  }
})
vi.mock('../../lib/crm-data', () => ({ useTeammates: () => ({ items: [] }), teammateLabel: () => 'Teammate' }))
vi.mock('./QueueRow', () => ({
  QueueRow: ({ item }: { item: { id: string; contact: { external_id: string } } }) => (
    <div data-testid={`conversation-${item.id}`}>{item.contact.external_id}</div>
  ),
}))
vi.mock('../email/EmailQueueRow', () => ({ EmailQueueRow: () => null }))
vi.mock('../calls/CallButton', () => ({ CallButton: () => null }))

const { InboxScreen } = await import('./InboxScreen')

const targetConversation = {
  id: TARGET_CONVERSATION_ID,
  contact_id: 'contact-1',
  status: 'open',
  bot_paused: false,
  unread_count: 1,
  last_customer_message_at: '2026-08-10T17:53:51Z',
  last_bot_message_at: null,
  escalation_resolved: true,
  assigned_to: DEMO_REP_ID,
  contact: { profile_name: null, channel: 'whatsapp', external_id: '919947638424', profile: null, is_opted_out: false },
}

describe('PixellEdu inbox visibility', () => {
  beforeEach(() => {
    queueItems.splice(0, queueItems.length, targetConversation)
  })

  it('opens a manager on All and shows the target conversation', () => {
    clientState.role = 'manager'
    authState.userId = 'manager-id'
    render(<MemoryRouter><InboxScreen canSend={false} /></MemoryRouter>)

    const scopeTabs = screen.getByRole('tablist', { name: 'Inbox scope' })
    expect(within(scopeTabs).getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByTestId(`conversation-${TARGET_CONVERSATION_ID}`)).toHaveTextContent('919947638424')
  })

  it('opens the assigned demo rep on My inbox and shows the target conversation', () => {
    clientState.role = 'agent'
    authState.userId = DEMO_REP_ID
    render(<MemoryRouter><InboxScreen canSend /></MemoryRouter>)

    expect(screen.getByRole('tab', { name: 'My inbox' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByTestId(`conversation-${TARGET_CONVERSATION_ID}`)).toHaveTextContent('919947638424')
  })

  it('does not show LuxeLine data while PixellEdu is active', () => {
    clientState.role = 'manager'
    authState.userId = 'manager-id'
    render(<MemoryRouter><InboxScreen canSend={false} /></MemoryRouter>)

    expect(screen.queryByText(/LuxeLine/i)).not.toBeInTheDocument()
  })
})
