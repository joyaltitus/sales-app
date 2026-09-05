import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LeadItem, LeadStage } from '../../lib/leads-data'

// Notes are the rep's own record of what was said. A refused add or delete that
// says nothing is worse than an error: the rep believes the note is filed.
const { addNote } = vi.hoisted(() => ({ addNote: vi.fn() }))
vi.mock('../../lib/crm-actions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/crm-actions')>()),
  addNote,
  saveLead: vi.fn(),
}))
vi.mock('../../lib/crm-data', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/crm-data')>()),
  useNotes: () => ({ items: [], loading: false, reload: vi.fn() }),
}))
vi.mock('../../auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { email: 'rep@example.com' } } }) }))

const { LeadDrawer } = await import('./LeadDrawer')

const stages: LeadStage[] = [
  { id: 'stage-1', stage_key: 'discovery', label: 'Discovery', sort_order: 1, is_won: false },
]

const lead: LeadItem = {
  id: 'lead-1',
  contact_id: 'ct-1',
  conversation_id: null,
  stage_id: 'stage-1',
  status: 'open',
  est_value: null,
  temperature_override: null,
  next_action: null,
  objection: null,
  lost_reason: null,
  updated_at: '2026-09-01T00:00:00Z',
  owner_id: null,
  created_by: null,
  contact: { profile_name: 'Anjali Rao', channel: 'whatsapp', external_id: '919876543210' },
  conversation: null,
}

function renderDrawer() {
  return render(
    <LeadDrawer clientId="c-1" lead={lead} stages={stages} onClose={vi.fn()} onSaved={vi.fn()} />,
  )
}

describe('LeadDrawer note failures', () => {
  beforeEach(() => addNote.mockReset())

  it('says so when the note is refused, and keeps the text to retry with', async () => {
    const user = userEvent.setup()
    addNote.mockResolvedValue({ ok: false, reason: 'denied' })
    renderDrawer()

    const box = screen.getByLabelText('Add note')
    await user.type(box, 'Discussed the fee structure')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn't save the note/i)
    expect(box).toHaveValue('Discussed the fee structure')
  })

  it('clears the box and shows nothing when the note lands', async () => {
    const user = userEvent.setup()
    addNote.mockResolvedValue({ ok: true })
    renderDrawer()

    const box = screen.getByLabelText('Add note')
    await user.type(box, 'Discussed the fee structure')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(box).toHaveValue('')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
