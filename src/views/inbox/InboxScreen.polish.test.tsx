import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const PIXELLEDU_ID = 'cc4a7484-064e-495c-b611-b5ca105410f7'
const CONV_ID = 'conv-1'
const CONTACT_ID = 'contact-1'

const { queueItems, leadState, teammatesState, markConversationRead } = vi.hoisted(() => ({
  queueItems: [] as Array<Record<string, unknown>>,
  leadState: { next_action: null as string | null },
  teammatesState: [] as Array<{ user_id: string; role: string; displayName?: string | null }>,
  markConversationRead: vi.fn().mockResolvedValue({ ok: true }),
}))

vi.mock('../../shell/ClientProvider', () => ({
  useClient: () => ({ activeClient: { id: PIXELLEDU_ID, name: 'PixellEdu', role: 'manager' } }),
}))
vi.mock('../../auth/AuthProvider', () => ({
  useAuth: () => ({ session: { user: { id: 'manager-user-id' } } }),
}))
vi.mock('../../lib/crm-actions', () => ({ markConversationRead }))
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
vi.mock('../../lib/crm-data', () => ({
  useTeammates: () => ({ items: teammatesState }),
  teammateLabel: (t: { displayName?: string | null; role: string; user_id: string }) =>
    t.displayName || `${t.role} · ${t.user_id.slice(0, 4)}`,
  useConvLead: () => ({
    lead: leadState.next_action ? { id: 'lead-1', next_action: leadState.next_action } : null,
    reload: vi.fn(),
  }),
}))
vi.mock('./QueueRow', () => ({
  QueueRow: ({ item, onSelect }: { item: { id: string; contact: { external_id: string } }; onSelect: () => void }) => (
    <button data-testid={`conversation-${item.id}`} onClick={onSelect}>
      {item.contact.external_id}
    </button>
  ),
}))
vi.mock('../email/EmailQueueRow', () => ({
  EmailQueueRow: () => <div data-testid="email-queue-row">Email Row</div>,
}))
vi.mock('../calls/CallButton', () => ({ CallButton: () => null }))
vi.mock('./ContextRail', () => ({ ContextRail: () => <div data-testid="context-rail">Context Rail</div> }))
vi.mock('./Composer', () => ({ Composer: () => <div data-testid="composer">Composer</div> }))

const { InboxScreen } = await import('./InboxScreen')

const sampleConversation = {
  id: CONV_ID,
  contact_id: CONTACT_ID,
  status: 'open',
  bot_paused: false,
  unread_count: 1,
  last_customer_message_at: '2026-08-10T17:53:51Z',
  last_bot_message_at: null,
  escalation_resolved: true,
  assigned_to: 'external-user-9999',
  contact: { profile_name: 'Asha Patel', channel: 'whatsapp', external_id: '919947638424', profile: null, is_opted_out: false },
}

describe('InboxScreen S1 polish acceptance tests (sales-app#21)', () => {
  beforeEach(() => {
    queueItems.splice(0, queueItems.length, { ...sampleConversation, unread_count: 1 })
    leadState.next_action = null
    teammatesState.splice(0, teammatesState.length)
    markConversationRead.mockClear()
  })

  it('AT-01: empty state copy matches the actual sort order (most recent message first)', () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <InboxScreen canSend={false} />
      </MemoryRouter>,
    )

    expect(
      screen.getByText('The queue is ordered by most recent message.'),
    ).toBeInTheDocument()
    expect(
      screen.queryByText('The queue is ordered by who has waited longest.'),
    ).not.toBeInTheDocument()
  })

  it('AT-02: rail toggle button is labeled "Hide details" when open and "Details" when closed', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={[`/?c=${CONV_ID}`]}>
        <InboxScreen canSend={false} />
      </MemoryRouter>,
    )

    // With a conversation open, find the Details/Hide details toggle
    const toggleButton = screen.getByRole('button', { name: /Details|Hide details/i })
    expect(toggleButton).toHaveTextContent(/Details|Hide details/)
    expect(toggleButton).not.toHaveTextContent(/^Close$/)

    // Click toggle to flip state
    const initialText = toggleButton.textContent
    await user.click(toggleButton)
    expect(toggleButton.textContent).not.toBe(initialText)
    expect(toggleButton.textContent).not.toBe('Close')
  })

  it('AT-06: thread header derives Next-Best-Action from real lead data', () => {
    leadState.next_action = 'Confirm fee breakdown and ask for seat reservation'
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={[`/?c=${CONV_ID}`]}>
        <InboxScreen canSend={false} />
      </MemoryRouter>,
    )

    expect(
      screen.getByText('Next: Confirm fee breakdown and ask for seat reservation'),
    ).toBeInTheDocument()
    expect(
      screen.queryByText('Next: answer the price question'),
    ).not.toBeInTheDocument()
  })

  it('AT-07: Email demo row is hidden under "My inbox" and visible under "All"', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <InboxScreen canSend={false} />
      </MemoryRouter>,
    )

    // Under "All" scope, email row is visible
    expect(screen.getByTestId('email-queue-row')).toBeInTheDocument()

    // Switch to "My inbox" scope
    const myTab = screen.getByRole('tab', { name: 'My inbox' })
    await user.click(myTab)

    // Email row should be hidden under "My inbox"
    expect(screen.queryByTestId('email-queue-row')).not.toBeInTheDocument()
  })

  it('renders unread indicator dot on WhatsApp channel tab when WhatsApp conversation is unread', () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <InboxScreen canSend={false} />
      </MemoryRouter>,
    )

    // WhatsApp has 1 unread conversation
    expect(screen.getByTestId('unread-dot-whatsapp')).toBeInTheDocument()
    // Instagram has 0 unread
    expect(screen.queryByTestId('unread-dot-instagram')).not.toBeInTheDocument()
  })

  it('renders unread indicator dot on My inbox scope tab when user has unread conversation', () => {
    queueItems.splice(0, queueItems.length, {
      ...sampleConversation,
      assigned_to: 'manager-user-id',
      unread_count: 2,
    })

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <InboxScreen canSend={false} />
      </MemoryRouter>,
    )

    expect(screen.getByTestId('unread-dot-my')).toBeInTheDocument()
  })

  it('renders unread count on Unread filter chip', () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <InboxScreen canSend={false} />
      </MemoryRouter>,
    )

    const unreadButton = screen.getByRole('button', { name: /Unread/i })
    expect(unreadButton).toHaveTextContent('1')
  })

  it('does not mutate the queue item and sends only one read request across rerenders', async () => {
    const user = userEvent.setup()
    const original = queueItems[0]
    const { rerender } = render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <InboxScreen canSend={false} />
      </MemoryRouter>,
    )

    await user.click(screen.getByTestId(`conversation-${CONV_ID}`))
    await vi.waitFor(() => expect(markConversationRead).toHaveBeenCalledTimes(1))
    rerender(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <InboxScreen canSend={false} />
      </MemoryRouter>,
    )

    expect(markConversationRead).toHaveBeenCalledTimes(1)
    expect(queueItems[0]).toBe(original)
    expect(queueItems[0].unread_count).toBe(1)
  })
})
