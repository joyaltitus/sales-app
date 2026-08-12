import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NotificationCenter } from './NotificationCenter'

// S12 SA-PUSH-01 tab badge: document.title + OS badge must reflect REAL unread work only
// (labeled_to_you/needs_human/follow_up_due), never the sample/preview rows the in-app
// bell also shows for demo purposes — those are the two behaviors this file adds.
const { useNotificationsMock } = vi.hoisted(() => ({ useNotificationsMock: vi.fn() }))

vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({ session: { user: { id: 'user-1' } } }),
}))
vi.mock('../shell/ClientProvider', () => ({
  useClient: () => ({ activeClient: { id: 'client-1' } }),
}))
vi.mock('../lib/notifications-data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/notifications-data')>()
  return {
    ...actual,
    useNotifications: useNotificationsMock,
    markNotificationsRead: vi.fn(),
  }
})

function row(over: Partial<{ id: string; kind: string; read_at: string | null }> = {}) {
  return {
    id: over.id ?? 'notif-1',
    client_id: 'client-1',
    kind: over.kind ?? 'labeled_to_you',
    conversation_id: null,
    follow_up_id: null,
    title: 'A chat was labeled to you',
    body: null,
    draft: null,
    read_at: over.read_at ?? null,
    created_at: new Date().toISOString(),
  }
}

function setAppBadgeSpy() {
  const setAppBadge = vi.fn().mockResolvedValue(undefined)
  const clearAppBadge = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'setAppBadge', { configurable: true, value: setAppBadge })
  Object.defineProperty(navigator, 'clearAppBadge', { configurable: true, value: clearAppBadge })
  return { setAppBadge, clearAppBadge }
}

describe('NotificationCenter tab badge', () => {
  beforeEach(() => {
    document.title = 'Sales App'
  })
  afterEach(() => {
    vi.restoreAllMocks()
    delete (navigator as unknown as { setAppBadge?: unknown }).setAppBadge
    delete (navigator as unknown as { clearAppBadge?: unknown }).clearAppBadge
  })

  it('sets the title count and calls setAppBadge for real unread notifications', async () => {
    useNotificationsMock.mockReturnValue({ items: [row({ id: 'a' }), row({ id: 'b' })], reload: vi.fn() })
    const { setAppBadge } = setAppBadgeSpy()

    render(<MemoryRouter><NotificationCenter /></MemoryRouter>)

    expect(document.title).toBe('(2) Sales App')
    expect(setAppBadge).toHaveBeenCalledWith(2)
  })

  it('a read notification does not count toward the badge', async () => {
    useNotificationsMock.mockReturnValue({
      items: [row({ id: 'a', read_at: new Date().toISOString() })],
      reload: vi.fn(),
    })
    const { clearAppBadge } = setAppBadgeSpy()

    render(<MemoryRouter><NotificationCenter /></MemoryRouter>)

    expect(document.title).toBe('Sales App')
    expect(clearAppBadge).toHaveBeenCalled()
  })

  it('a follow_up_escalation row (frozen-out of push) still counts for the in-app bell but not differently here — badge tracks all live unread kinds the rail shows', async () => {
    // follow_up_escalation maps to the 'follow_up' rail kind, which IS actionable —
    // the badge intentionally mirrors the in-app bell's actionable set, not the push
    // dispatch job's narrower 3-kind allowlist (that allowlist governs SENDING a push,
    // not what counts as "you have unread actionable work").
    useNotificationsMock.mockReturnValue({
      items: [row({ id: 'a', kind: 'follow_up_escalation' })],
      reload: vi.fn(),
    })
    setAppBadgeSpy()

    render(<MemoryRouter><NotificationCenter /></MemoryRouter>)

    expect(document.title).toBe('(1) Sales App')
  })

  it('with zero live notifications, badge/title stay at the clean baseline', async () => {
    useNotificationsMock.mockReturnValue({ items: [], reload: vi.fn() })
    const { clearAppBadge, setAppBadge } = setAppBadgeSpy()

    render(<MemoryRouter><NotificationCenter /></MemoryRouter>)

    expect(document.title).toBe('Sales App')
    expect(clearAppBadge).toHaveBeenCalled()
    expect(setAppBadge).not.toHaveBeenCalled()
  })

  it('does not throw when the Badge API is unavailable (most browsers today)', async () => {
    useNotificationsMock.mockReturnValue({ items: [row()], reload: vi.fn() })
    // deliberately NOT calling setAppBadgeSpy() — navigator.setAppBadge is undefined
    expect(() => render(<MemoryRouter><NotificationCenter /></MemoryRouter>)).not.toThrow()
    expect(document.title).toBe('(1) Sales App')
  })
})
