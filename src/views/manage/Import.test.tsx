import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const TENANT = 'a0de0000-0000-4000-8000-000000000001'
const BATCH = '7f3c9a10-0000-4000-8000-000000000009'

const { hubFetch } = vi.hoisted(() => ({ hubFetch: vi.fn() }))
vi.mock('../../lib/api', () => ({ hubFetch }))
vi.mock('../../lib/supabase', () => ({ supabase: { from: vi.fn(), rpc: vi.fn() } }))

const { Import, countsLine, confirmToken } = await import('./Import')
import type { ImportBatch } from './Import'

function batch(over: Partial<ImportBatch> = {}): ImportBatch {
  return {
    id: BATCH,
    filename: 'old-customers.csv',
    status: 'committed',
    counts: { rows: 20, new: 15, dup_in_file: 1, dup_existing: 2, invalid: 2 },
    consent: { provenance: 'past_customers' },
    messaging_mode: 'do_not_message',
    stage_failed: null,
    created_at: '2026-09-03T09:00:00Z',
    ...over,
  }
}

const props = { clientId: TENANT, userId: 'u-1', names: new Map<string, string>() }

beforeEach(() => {
  hubFetch.mockReset()
  hubFetch.mockResolvedValue({ kind: 'ok', data: {} })
})

describe('the dry-run summary', () => {
  it('reads the counts the database wrote, folding both kinds of duplicate together', () => {
    expect(countsLine({ rows: 20, new: 15, dup_in_file: 1, dup_existing: 2, invalid: 2 })).toBe(
      '15 new · 3 duplicates · 2 unusable',
    )
  })

  it('says nothing rather than "0 new" before a file has been checked', () => {
    expect(countsLine({})).toBe('Not checked yet')
  })
})

describe('the do-not-message guard', () => {
  it('marks a committed cohort as blocked and offers to lift it', () => {
    render(<Import {...props} preview={[batch()]} />)
    expect(screen.getByText('Do not message')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Lift the messaging block/i })).toBeInTheDocument()
  })

  it('never offers to lift a bought list — that one is permanent', () => {
    render(<Import {...props} preview={[batch({ consent: { provenance: 'purchased_list' } })]} />)
    expect(screen.queryByRole('button', { name: /Lift the messaging block/i })).not.toBeInTheDocument()
    expect(screen.getByText(/can never be messaged from here/i)).toBeInTheDocument()
  })

  it('holds the lift until the batch id is typed back AND a reason is given', async () => {
    const user = userEvent.setup({ delay: null })
    render(<Import {...props} preview={[batch()]} />)
    await user.click(screen.getByRole('button', { name: /Lift the messaging block/i }))

    const lift = screen.getByRole('button', { name: 'Lift the block' })
    expect(lift).toBeDisabled()

    await user.type(screen.getByLabelText('Confirmation code'), confirmToken(BATCH))
    expect(lift).toBeDisabled() // the reason is still empty

    await user.type(screen.getByLabelText('Consent reason'), 'Signed enrolment forms.')
    expect(lift).toBeEnabled()

    await user.click(lift)
    await waitFor(() =>
      expect(hubFetch).toHaveBeenCalledWith(
        `/v1/import/batches/${BATCH}/unlock_messaging`,
        expect.objectContaining({ method: 'POST' }),
      ),
    )
    const body = JSON.parse(hubFetch.mock.calls[0][1].body as string)
    expect(body).toEqual({
      client_id: TENANT,
      confirm: confirmToken(BATCH),
      attestation: 'Signed enrolment forms.',
    })
  })

  it('accepts the code in either case — the uuid is the secret, not its casing', async () => {
    const user = userEvent.setup({ delay: null })
    render(<Import {...props} preview={[batch()]} />)
    await user.click(screen.getByRole('button', { name: /Lift the messaging block/i }))
    await user.type(screen.getByLabelText('Confirmation code'), confirmToken(BATCH).toUpperCase())
    await user.type(screen.getByLabelText('Consent reason'), 'x')

    await user.click(screen.getByRole('button', { name: 'Lift the block' }))
    await waitFor(() => expect(hubFetch).toHaveBeenCalled())
    // Sent lowercase, because that is what `left(id::text, 8)` compares against.
    expect(JSON.parse(hubFetch.mock.calls[0][1].body as string).confirm).toBe(confirmToken(BATCH))
  })

  it('typing the wrong code keeps the button dead — the round trip is not the wall', async () => {
    const user = userEvent.setup()
    render(<Import {...props} preview={[batch()]} />)
    await user.click(screen.getByRole('button', { name: /Lift the messaging block/i }))
    await user.type(screen.getByLabelText('Confirmation code'), 'deadbeef')
    await user.type(screen.getByLabelText('Consent reason'), 'because')
    expect(screen.getByRole('button', { name: 'Lift the block' })).toBeDisabled()
    expect(hubFetch).not.toHaveBeenCalled()
  })

  it('shows the refusal code when the database declines the lift', async () => {
    const user = userEvent.setup()
    hubFetch.mockResolvedValue({ kind: 'forbidden', code: 'consent_provenance_blocked' })
    render(<Import {...props} preview={[batch()]} />)
    await user.click(screen.getByRole('button', { name: /Lift the messaging block/i }))
    await user.type(screen.getByLabelText('Confirmation code'), confirmToken(BATCH))
    await user.type(screen.getByLabelText('Consent reason'), 'x')
    await user.click(screen.getByRole('button', { name: 'Lift the block' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('consent_provenance_blocked')
  })
})

describe('the pipeline buttons', () => {
  it('offers the commit only once a dry run has made the batch ready', () => {
    render(<Import {...props} preview={[batch({ status: 'ready', messaging_mode: 'do_not_message' })]} />)
    expect(screen.getByRole('button', { name: /Add 15 contacts/i })).toBeInTheDocument()
  })

  it('explains a blocked batch as a column problem, not bad data', () => {
    render(
      <Import
        {...props}
        preview={[batch({ status: 'awaiting_mapping', counts: { rows: 20, new: 2, invalid: 18, blocked: 'invalid_ratio' } })]}
      />,
    )
    expect(screen.getByText(/column read the wrong way round/i)).toBeInTheDocument()
  })
})

describe('upload', () => {
  it('will not send a file without a stated provenance', async () => {
    const user = userEvent.setup()
    render(<Import {...props} preview={[]} />)
    const file = new File(['phone\n919876543210\n'], 'list.csv', { type: 'text/csv' })
    await user.upload(screen.getByLabelText('File'), file)
    expect(screen.getByRole('button', { name: /Upload/i })).toBeDisabled()

    await user.click(screen.getByLabelText('People who have bought from us'))
    expect(screen.getByRole('button', { name: /Upload/i })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: /Upload/i }))
    await waitFor(() => expect(hubFetch).toHaveBeenCalledWith('/v1/import/files', expect.anything()))
    const form = hubFetch.mock.calls[0][1].body as FormData
    expect(form.get('client_id')).toBe(TENANT)
    expect(form.get('consent_provenance')).toBe('past_customers')
    expect((form.get('file') as File).name).toBe('list.csv')
  })

  it('warns before a bought list is uploaded, not after', async () => {
    const user = userEvent.setup()
    render(<Import {...props} preview={[]} />)
    await user.click(screen.getByLabelText('A list we bought'))
    expect(screen.getByRole('alert')).toHaveTextContent(/can never be messaged/i)
  })
})
