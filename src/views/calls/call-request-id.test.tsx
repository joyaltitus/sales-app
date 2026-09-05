import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// startCallSession upserts call_sessions on (client_id, client_request_id).
// That conflict target is the ONLY thing stopping one real call from becoming
// two rows, and it does nothing if the id is minted fresh inside the handler.
// Both screens below used to do exactly that.
const { startCallSession, completeCall } = vi.hoisted(() => ({
  startCallSession: vi.fn(),
  completeCall: vi.fn(),
}))
vi.mock('../../lib/calls-data', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/calls-data')>()),
  startCallSession,
  completeCall,
  useCallLogs: () => ({ items: [], loading: false }),
}))
vi.mock('../../lib/objections-data', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/objections-data')>()),
  useObjectionTaxonomy: () => ({ items: [], loading: false }),
  useObjectionLogs: () => ({ items: [], loading: false }),
}))
vi.mock('../../shell/ClientProvider', () => ({ useClient: () => ({ activeClient: { id: 'c-1' } }) }))
vi.mock('../../auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'u-1' } } }) }))

const { CallExperience } = await import('./CallExperience')

function idsFromCalls() {
  return startCallSession.mock.calls.map(([args]) => args.clientRequestId)
}

describe('CallExperience call_request_id', () => {
  beforeEach(() => {
    startCallSession.mockReset()
    completeCall.mockReset()
  })

  it('reuses one id when Start call is pressed twice — the button has no busy guard', async () => {
    const user = userEvent.setup()
    // A refused start leaves the sheet on the brief step, so the rep can press
    // again. If the first attempt actually reached the database and only the
    // response was lost, the retry must upsert that row, not fork a new one.
    startCallSession.mockResolvedValue({ ok: false, message: 'network' })

    render(
      <CallExperience
        person="Anjali Rao"
        phone="9876543210"
        dealValue={null}
        stage={null}
        contactId="ct-1"
        onClose={vi.fn()}
        onComplete={vi.fn()}
      />,
    )

    const start = screen.getByRole('button', { name: /start call/i })
    await user.click(start)
    await user.click(start)

    expect(startCallSession).toHaveBeenCalledTimes(2)
    const [first, second] = idsFromCalls()
    expect(first).toBeTruthy()
    expect(second).toBe(first)
  })
})
