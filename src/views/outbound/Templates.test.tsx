import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { WaTemplate } from '../../lib/outbound-data'

const TENANT = 'a0de0000-0000-4000-8000-000000000001'

const TEMPLATES: WaTemplate[] = [
  {
    id: 't1',
    template_name: 'batch_nudge',
    language: 'en',
    category: 'marketing',
    body_preview: 'Hi {{1}}, seats are open.',
    variables: ['name'],
    meta_status: 'approved',
    active: true,
  },
  {
    id: 't2',
    template_name: 'seat_reminder',
    language: 'en',
    category: 'utility',
    // Two placeholders in the copy, one registered variable — the send would be
    // rejected server-side with params_mismatch, and nobody can fix it here.
    body_preview: 'Hi {{1}}, your seat for {{2}} is held.',
    variables: ['name'],
    meta_status: 'pending',
    active: false,
  },
]

vi.mock('../../shell/ClientProvider', () => ({ useClient: () => ({ activeClient: { id: TENANT } }) }))
vi.mock('../../lib/outbound-data', async (orig) => ({
  ...(await orig<typeof import('../../lib/outbound-data')>()),
  useWaTemplates: () => ({ items: TEMPLATES, loading: false, error: null, reload: () => {} }),
}))

const { Templates } = await import('./Templates')

describe('Template registry', () => {
  it('renders the registry with no write control at all', () => {
    render(<Templates />)
    expect(screen.getByText('batch_nudge')).toBeInTheDocument()
    expect(screen.getByText('seat_reminder')).toBeInTheDocument()
    // wa_templates_write is super_admin: a client may look, never save. The
    // assertion is on the ABSENCE of every control, not on a disabled one — a
    // disabled button still promises the capability exists.
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(screen.queryAllByRole('textbox')).toHaveLength(0)
    expect(screen.getByText(/registered by your account manager/i)).toBeInTheDocument()
  })

  it('warns when the wording and the registered blanks disagree', () => {
    render(<Templates />)
    expect(screen.getByText(/2 blanks but 1 are registered/i)).toBeInTheDocument()
  })

  it("shows a template's real Meta status rather than implying it can send", () => {
    render(<Templates />)
    expect(screen.getByText('approved')).toBeInTheDocument()
    expect(screen.getByText('pending')).toBeInTheDocument()
    expect(screen.getByText('inactive')).toBeInTheDocument()
  })
})
