import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Twin of the CallExperience defect. The outcome buttons in this sheet carry no
// busy guard, so two taps used to mint two client_request_ids and fork the
// call_sessions upsert into two rows for one call.
const { startCallSession, completeCall } = vi.hoisted(() => ({
  startCallSession: vi.fn(),
  completeCall: vi.fn(),
}))
vi.mock('../../lib/calls-data', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/calls-data')>()),
  startCallSession,
  completeCall,
}))
vi.mock('../../lib/objections-data', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/objections-data')>()),
  useObjectionTaxonomy: () => ({ items: [], loading: false }),
}))
vi.mock('../../lib/scripts-data', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/scripts-data')>()),
  useActiveScript: () => ({ script: null, loading: false }),
}))
vi.mock('../../shell/ClientProvider', () => ({ useClient: () => ({ activeClient: { id: 'c-1' } }) }))
vi.mock('../../auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'u-1' } } }) }))

const { ObjectionCapture } = await import('./ObjectionCapture')

function ids() {
  return startCallSession.mock.calls.map(([args]) => args.clientRequestId)
}

function renderCapture() {
  return render(<ObjectionCapture contactId="ct-1" source="chat" />)
}

describe('ObjectionCapture call_request_id', () => {
  beforeEach(() => {
    startCallSession.mockReset().mockResolvedValue({ ok: true, id: 'cs-1' })
    completeCall.mockReset().mockResolvedValue({ ok: true })
  })

  it('reuses one id across a double-tap on the same outcome', async () => {
    const user = userEvent.setup()
    renderCapture()

    await user.click(screen.getByRole('button', { name: /log outcome/i }))
    const progressing = screen.getByRole('button', { name: 'Progressing' })
    // Both taps must land before the first await settles — that is what a real
    // double-tap is, and the sheet closes itself once the first one finishes.
    await act(async () => {
      fireEvent.click(progressing)
      fireEvent.click(progressing)
    })

    expect(startCallSession).toHaveBeenCalledTimes(2)
    const [first, second] = ids()
    expect(first).toBeTruthy()
    expect(second).toBe(first)
  })

  it('mints a fresh id when the sheet is opened again — a new sheet is a new call', async () => {
    const user = userEvent.setup()
    renderCapture()

    await user.click(screen.getByRole('button', { name: /log outcome/i }))
    await user.click(screen.getByRole('button', { name: 'Progressing' }))

    await user.click(screen.getByRole('button', { name: /log outcome/i }))
    await user.click(screen.getByRole('button', { name: 'Progressing' }))

    const [first, second] = ids()
    expect(second).not.toBe(first)
  })
})
