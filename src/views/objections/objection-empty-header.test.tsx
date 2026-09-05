import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

// REG-006. In compact mode this sits directly above the composer, and the caps
// "Objection" header rendered unconditionally — a section title over nothing, on
// the screen with the least room to spare.
const { useObjectionTaxonomy } = vi.hoisted(() => ({ useObjectionTaxonomy: vi.fn() }))
vi.mock('../../lib/objections-data', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/objections-data')>()),
  useObjectionTaxonomy,
}))
vi.mock('../../lib/scripts-data', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/scripts-data')>()),
  useActiveScript: () => ({ script: null, loading: false }),
}))
vi.mock('../../lib/calls-data', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/calls-data')>()),
  startCallSession: vi.fn(),
  completeCall: vi.fn(),
}))
vi.mock('../../shell/ClientProvider', () => ({ useClient: () => ({ activeClient: { id: 'c-1' } }) }))
vi.mock('../../auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'u-1' } } }) }))

const { ObjectionCapture } = await import('./ObjectionCapture')

const TAXONOMY = [{ id: 't-1', key: 'price', label: 'Too expensive' }]

describe('ObjectionCapture compact header', () => {
  it('shows no section header when the compact strip has nothing under it', () => {
    useObjectionTaxonomy.mockReturnValue({ items: [], loading: false })
    render(<ObjectionCapture contactId="ct-1" source="chat" compact />)

    expect(screen.queryByText('Objection')).not.toBeInTheDocument()
  })

  it('shows it as soon as there are objections to log', () => {
    useObjectionTaxonomy.mockReturnValue({ items: TAXONOMY, loading: false })
    render(<ObjectionCapture contactId="ct-1" source="chat" compact />)

    expect(screen.getByText('Objection')).toBeInTheDocument()
  })

  it('keeps the header in the full (non-compact) card, which is a standalone section', () => {
    useObjectionTaxonomy.mockReturnValue({ items: [], loading: false })
    render(<ObjectionCapture contactId="ct-1" source="crm" />)

    expect(screen.getByText('Objection')).toBeInTheDocument()
  })
})
