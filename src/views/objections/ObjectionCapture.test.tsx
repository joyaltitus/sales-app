import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { startCallSession, completeCall } = vi.hoisted(() => ({
  startCallSession: vi.fn(),
  completeCall: vi.fn(),
}))

vi.mock('../../shell/ClientProvider', () => ({
  useClient: () => ({ activeClient: { id: 'client-1' } }),
}))
vi.mock('../../auth/AuthProvider', () => ({
  useAuth: () => ({ session: { user: { id: 'user-1' } } }),
}))
vi.mock('../../lib/objections-data', () => ({
  useObjectionTaxonomy: () => ({ items: [] }),
  logObjection: vi.fn(),
  undoObjection: vi.fn(),
  saveNote: vi.fn(),
}))
vi.mock('../../lib/scripts-data', () => ({
  useActiveScript: () => ({ activeScript: null, loading: false }),
  insertScriptUsage: vi.fn(),
  updateScriptUsageFeedback: vi.fn(),
  insertPlaybookGap: vi.fn(),
}))
vi.mock('../../lib/calls-data', () => ({
  startCallSession,
  completeCall,
}))
vi.mock('../../ui/agent/VoiceButton', () => ({ VoiceButton: () => null }))

const { ObjectionCapture } = await import('./ObjectionCapture')

describe('ObjectionCapture call session lifecycle (AT-04)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    startCallSession.mockResolvedValue({ ok: true, id: 'sess-123' })
    completeCall.mockResolvedValue({ ok: true, callLogId: 'cl-1' })
  })

  it('opening "Log call result" and dismissing with "Not now" leaves no orphaned session in the database', async () => {
    const user = userEvent.setup()

    render(
      <ObjectionCapture
        contactId="contact-1"
        source="chat"
        conversationId="conv-1"
      />,
    )

    // Open sheet
    await user.click(screen.getByRole('button', { name: /Log call result/i }))
    expect(screen.getByText('How did it go?')).toBeInTheDocument()

    // No DB call yet on open
    expect(startCallSession).not.toHaveBeenCalled()

    // Dismiss with "Not now"
    await user.click(screen.getByRole('button', { name: /Not now/i }))
    expect(screen.queryByText('How did it go?')).not.toBeInTheDocument()

    // Still no DB call made
    expect(startCallSession).not.toHaveBeenCalled()
    expect(completeCall).not.toHaveBeenCalled()
  })

  it('choosing an outcome initiates session creation and logging', async () => {
    const user = userEvent.setup()

    render(
      <ObjectionCapture
        contactId="contact-1"
        source="chat"
        conversationId="conv-1"
      />,
    )

    await user.click(screen.getByRole('button', { name: /Log call result/i }))
    await user.click(screen.getByRole('button', { name: 'Closed' }))

    expect(startCallSession).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: 'client-1',
        contactId: 'contact-1',
        conversationId: 'conv-1',
        actorId: 'user-1',
        surface: 'objection-capture',
      }),
    )
    expect(completeCall).toHaveBeenCalledWith('sess-123', 'closed', undefined)
  })
})
