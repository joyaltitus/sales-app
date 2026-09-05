import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// The Done button paints optimistically and then writes. Fired and forgotten, a
// refused write left the rep looking at a todo marked done that the manager
// still saw as open — the exact "lies to the operator" shape this lane exists
// to remove.
const { toggleTodo } = vi.hoisted(() => ({ toggleTodo: vi.fn() }))

vi.mock('../../lib/todos-data', () => ({
  toggleTodo,
  useTodos: () => ({
    items: [{
      id: 'todo-1',
      client_id: 'c-1',
      title: 'Call the Sharma family back',
      assignee: 'u-1',
      assigneeName: 'Rep',
      due_at: null,
      status: 'pending',
      source: 'manager',
      ref_id: null,
      note: null,
      created_by: 'u-mgr',
      createdByName: 'Manager',
      completed_at: null,
      created_at: '2026-09-01T00:00:00Z',
      updated_at: '2026-09-01T00:00:00Z',
    }],
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
}))
vi.mock('../../lib/inbox-data', () => ({
  useQueue: () => ({
    items: [{
      id: 'conv-1',
      contact_id: 'ct-1',
      status: 'open',
      bot_paused: false,
      unread_count: 1,
      last_customer_message_at: '2026-09-01T09:00:00Z',
      last_bot_message_at: null,
      escalation_resolved: true,
      assigned_to: 'u-1',
      rolling_summary: null,
      summary_upto: null,
      contact: { profile_name: 'Asha', channel: 'whatsapp', external_id: '919876543210', profile: null, is_opted_out: false },
    }],
    loading: false,
    error: null,
  }),
  useSnippets: () => ({ snippets: new Map() }),
}))
vi.mock('../../lib/leads-data', () => ({
  useFollowUps: () => ({
    items: [{
      id: 'fu-1',
      contact_id: 'ct-1',
      conversation_id: 'conv-1',
      due_at: '2026-01-01T09:00:00Z',
      status: 'pending',
      note: 'Call back about the fee plan',
      contact: { profile_name: 'Asha', channel: 'whatsapp', external_id: '919876543210' },
    }],
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
  completeFollowUp: vi.fn(),
  snoozeFollowUp: vi.fn(),
}))
vi.mock('../../lib/stats-data', () => ({
  useRepDailyStats: () => ({
    stats: { repliesToday: 0, followUpsDone: 0, followUpsPlanned: 0, responseTrend: null },
    loading: false,
  }),
}))
vi.mock('../../lib/targets-data', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/targets-data')>()),
  useTarget: () => ({ item: null }),
}))
vi.mock('../../lib/push', () => ({
  isSubscribed: async () => false,
  pushSupported: () => false,
  subscribe: vi.fn(),
}))
vi.mock('../../shell/ClientProvider', () => ({ useClient: () => ({ activeClient: { id: 'c-1', role: 'agent' } }) }))
vi.mock('../../auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'u-1' } } }) }))

const { Today } = await import('./Today')

const TODO = 'Call the Sharma family back'

function renderToday() {
  return render(<MemoryRouter><Today /></MemoryRouter>)
}

/** The overdue follow-up card carries a Done button too, so target the todo's
 *  own card rather than the first match on the page. */
function todoDone() {
  const card = screen.getByText(TODO).closest('article')!
  return within(card).getByRole('button', { name: /done/i })
}

describe('Today manager-todo Done', () => {
  beforeEach(() => toggleTodo.mockReset())

  it('sends the status it read, so the write cannot clobber a newer one', async () => {
    const user = userEvent.setup()
    toggleTodo.mockResolvedValue({ ok: true })
    renderToday()

    await user.click(todoDone())

    expect(toggleTodo).toHaveBeenCalledWith('c-1', 'todo-1', 'done', 'pending')
  })

  it('puts the card back when the write is refused', async () => {
    const user = userEvent.setup()
    toggleTodo.mockResolvedValue({ ok: false, reason: 'denied' })
    renderToday()

    expect(screen.getByText(TODO)).toBeInTheDocument()
    await user.click(todoDone())

    // It disappears optimistically, then must come back — staying gone is the
    // screen telling the rep a lie.
    await waitFor(() => expect(screen.getByText(TODO)).toBeInTheDocument())
  })

  it('leaves the card cleared when the write lands', async () => {
    const user = userEvent.setup()
    toggleTodo.mockResolvedValue({ ok: true })
    renderToday()

    await user.click(todoDone())

    await waitFor(() => expect(screen.queryByText(TODO)).not.toBeInTheDocument())
  })
})

// REG-001. Today builds more cross-screen CTAs than any other rep surface, and
// every one of them used to be root-absolute — /inbox, /leads, /crm — none of
// which is a route. They fell through to `<Route path="*">` and bounced the rep
// back to Today, the screen they were already on.
describe('Today cross-screen links', () => {
  it('keeps every link inside the rep shell', () => {
    const { container } = renderToday()
    const hrefs = [...container.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')!)

    expect(hrefs.length).toBeGreaterThan(0)
    for (const href of hrefs) {
      if (!href.startsWith('/')) continue
      expect(href).toMatch(/^\/rep(\/|\?|$)/)
    }
  })

  it('sends the rep to /rep/leads for a todo, since RepShell has no crm route', () => {
    const { container } = renderToday()
    const hrefs = [...container.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')!)

    expect(hrefs.some((h) => h.startsWith('/rep/leads?tab=todos'))).toBe(true)
    expect(hrefs.some((h) => h.includes('/crm'))).toBe(false)
  })
})

// REG-003. The ring measures follow-ups, not the monthly target it sits beside,
// so with nothing planned it rendered a confident 0% next to "No target set for
// you this month" — a score of zero rather than an absence of data.
describe('Today progress ring', () => {
  it('renders no ring when there is nothing to measure', () => {
    renderToday()
    expect(screen.queryByRole('progressbar', { name: /follow-up target/i })).not.toBeInTheDocument()
    expect(screen.queryByText('0%')).not.toBeInTheDocument()
  })

  it('still labels the complementary rail it sits beside (REG-051)', () => {
    renderToday()
    expect(screen.getByRole('complementary', { name: /waiting replies/i })).toBeInTheDocument()
  })
})
