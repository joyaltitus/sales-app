import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MOCK_GO_LIVE } from '../preview/preview-mocks'

const TENANT = 'a0de0000-0000-4000-8000-000000000001'
const USER = '11111111-1111-4111-8111-111111111111'

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../../lib/supabase', () => ({ supabase: { rpc } }))
vi.mock('../../shell/ClientProvider', () => ({ useClient: () => ({ activeClient: { id: TENANT } }) }))
vi.mock('../../auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: USER } } }) }))

const { GoLive } = await import('./GoLive')

/** pm_go_live_check's shape, with the named item already acked. */
function acked(item: string) {
  return {
    ...MOCK_GO_LIVE,
    manual_acks: {
      ...MOCK_GO_LIVE.manual_acks,
      [item]: { acked: true, note: null, acked_by: USER, acked_at: '2026-09-03T10:00:00Z' },
    },
  }
}

beforeEach(() => {
  rpc.mockReset()
})

describe('Go-live checklist', () => {
  it('names the remedy next to a check that is failing', () => {
    render(<GoLive preview={MOCK_GO_LIVE} />)
    // no_dangling_refs and scorecard_fresh are false in the fixture.
    expect(screen.getByText(/points at a product, reply or stage that no longer exists/i)).toBeInTheDocument()
    expect(screen.getByText(/Your setup changed after the last passing test run/i)).toBeInTheDocument()
    // A passing check carries no instruction — there is nothing to do.
    expect(screen.queryByText(/No channel is connected/i)).not.toBeInTheDocument()
  })

  it('counts everything still open, derived and human alike', () => {
    render(<GoLive preview={MOCK_GO_LIVE} />)
    // Two derived checks failing plus three unacked items.
    expect(screen.getByText('5 still open')).toBeInTheDocument()
    expect(screen.queryByText(/ready for customers/i)).not.toBeInTheDocument()
  })

  it('offers a confirm button only on the items nobody has confirmed', () => {
    render(<GoLive preview={MOCK_GO_LIVE} />)
    expect(screen.getAllByRole('button', { name: 'Mark done' })).toHaveLength(3)
  })

  it('records an ack against the database and re-reads the verdict from it', async () => {
    const user = userEvent.setup()
    rpc
      .mockResolvedValueOnce({ data: MOCK_GO_LIVE, error: null }) // first check
      .mockResolvedValueOnce({ data: { ok: true, item: 'real_device_check' }, error: null }) // the ack
      .mockResolvedValueOnce({ data: acked('real_device_check'), error: null }) // re-read
    render(<GoLive />)

    const buttons = await screen.findAllByRole('button', { name: 'Mark done' })
    await user.click(buttons[0])

    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith('pm_ack_go_live_item', {
        p_client_id: TENANT,
        p_item: 'real_device_check',
        p_note: null,
        p_auth_user_id: USER,
      }),
    )
    // The screen does not decide it is done — it asks the RPC again.
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Mark done' })).toHaveLength(2))
    expect(screen.getByText('4 still open')).toBeInTheDocument()
  })

  it('shows the refusal code when the database declines the ack', async () => {
    const user = userEvent.setup()
    rpc
      .mockResolvedValueOnce({ data: MOCK_GO_LIVE, error: null })
      .mockResolvedValueOnce({ data: { ok: false, reason: 'forbidden' }, error: null })
    render(<GoLive />)

    await user.click((await screen.findAllByRole('button', { name: 'Mark done' }))[0])

    expect(await screen.findByRole('alert')).toHaveTextContent('forbidden')
    // Nothing was optimistically ticked off.
    expect(screen.getAllByRole('button', { name: 'Mark done' })).toHaveLength(3)
  })

  it('says the read was refused rather than painting an empty checklist', async () => {
    rpc.mockResolvedValue({ data: { ok: false, reason: 'forbidden' }, error: null })
    render(<GoLive />)

    expect(await screen.findByText(/Your role may not open this checklist/i)).toBeInTheDocument()
    expect(screen.queryByText('Confirm yourself')).not.toBeInTheDocument()
  })
})
