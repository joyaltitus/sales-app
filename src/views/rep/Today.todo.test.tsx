import { render, screen, waitFor } from '@testing-library/react'
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
  useQueue: () => ({ items: [], loading: false, error: null }),
  useSnippets: () => ({ snippets: [] }),
}))
vi.mock('../../lib/leads-data', () => ({
  useFollowUps: () => ({ items: [], loading: false, error: null, reload: vi.fn() }),
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
vi.mock('../../shell/ClientProvider', () => ({ useClient: () => ({ activeClient: { id: 'c-1' } }) }))
vi.mock('../../auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'u-1' } } }) }))

const { Today } = await import('./Today')

const TODO = 'Call the Sharma family back'

function renderToday() {
  return render(<MemoryRouter><Today /></MemoryRouter>)
}

describe('Today manager-todo Done', () => {
  beforeEach(() => toggleTodo.mockReset())

  it('sends the status it read, so the write cannot clobber a newer one', async () => {
    const user = userEvent.setup()
    toggleTodo.mockResolvedValue({ ok: true })
    renderToday()

    await user.click(screen.getByRole('button', { name: /done/i }))

    expect(toggleTodo).toHaveBeenCalledWith('c-1', 'todo-1', 'done', 'pending')
  })

  it('puts the card back when the write is refused', async () => {
    const user = userEvent.setup()
    toggleTodo.mockResolvedValue({ ok: false, reason: 'denied' })
    renderToday()

    expect(screen.getByText(TODO)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /done/i }))

    // It disappears optimistically, then must come back — staying gone is the
    // screen telling the rep a lie.
    await waitFor(() => expect(screen.getByText(TODO)).toBeInTheDocument())
  })

  it('leaves the card cleared when the write lands', async () => {
    const user = userEvent.setup()
    toggleTodo.mockResolvedValue({ ok: true })
    renderToday()

    await user.click(screen.getByRole('button', { name: /done/i }))

    await waitFor(() => expect(screen.queryByText(TODO)).not.toBeInTheDocument())
  })
})
