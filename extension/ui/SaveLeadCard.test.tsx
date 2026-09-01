import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SaveLeadCard } from './SaveLeadCard'

const stages = [{ id: 's-1', label: 'New' }, { id: 's-2', label: 'Contacted' }]
const products = [
  { id: 'p-1', name: 'NEET Crash Course', price: 48000, category: 'course' },
  { id: 'p-2', name: 'Foundation Batch', price: 62000, category: 'course' },
]
const chat = { displayName: 'Anjali Rao', phoneE164: '+919876543210' }
const base = { stages, products, onSave: vi.fn() }

/** Fill the two other required fields so a test can isolate the third. */
async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
  await user.clear(screen.getByLabelText(/^Phone/))
  await user.type(screen.getByLabelText(/^Phone/), '+919900112233')
  await user.selectOptions(screen.getByLabelText(/^Course or product/), 'p-1')
}

describe('SaveLeadCard', () => {
  it('prefills the phone with +91 so a rep types only the ten digits', () => {
    render(<SaveLeadCard {...base} chat={null} />)
    expect(screen.getByLabelText(/^Phone/)).toHaveValue('+91')
  })

  it('does not overwrite a number that arrived from the chat', () => {
    render(<SaveLeadCard {...base} chat={chat} />)
    expect(screen.getByLabelText(/^Phone/)).toHaveValue('+919876543210')
    expect(screen.getByLabelText(/^Name/)).toHaveValue('Anjali Rao')
  })

  it('treats a BARE +91 as no number at all', async () => {
    const user = userEvent.setup()
    render(<SaveLeadCard {...base} chat={null} />)
    await user.selectOptions(screen.getByLabelText(/^Course or product/), 'p-1')
    // Prefix only: create_manual_lead would otherwise mint a contact keyed '91'.
    expect(screen.getByRole('button', { name: 'Save to CRM' })).toBeDisabled()
  })

  it('carries the web modal’s field set, source included', () => {
    render(<SaveLeadCard {...base} chat={null} />)
    for (const label of [/^Name/, /^Phone/, /^Source/, /^Course or product/, /^Stage/, /^Next action/, /^Note/]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument()
    }
    expect(screen.getByLabelText('Estimated value')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Walk-in / In-person' })).toBeInTheDocument()
  })

  it('lists the catalogue and prices the lead from the chosen product', async () => {
    const user = userEvent.setup()
    render(<SaveLeadCard {...base} chat={null} />)
    await user.selectOptions(screen.getByLabelText(/^Course or product/), 'p-2')
    expect(screen.getByLabelText('Estimated value')).toHaveValue('62000')
  })

  it('does not clobber a value the rep already typed', async () => {
    const user = userEvent.setup()
    render(<SaveLeadCard {...base} chat={null} />)
    await user.type(screen.getByLabelText('Estimated value'), '30000')
    await user.selectOptions(screen.getByLabelText(/^Course or product/), 'p-1')
    expect(screen.getByLabelText('Estimated value')).toHaveValue('30000')
  })

  it('PRODUCT IS REQUIRED — save stays shut until one is chosen', async () => {
    const user = userEvent.setup()
    render(<SaveLeadCard {...base} chat={null} />)
    await user.clear(screen.getByLabelText(/^Phone/))
    await user.type(screen.getByLabelText(/^Phone/), '+919900112233')
    expect(screen.getByRole('button', { name: 'Save to CRM' })).toBeDisabled()

    await user.selectOptions(screen.getByLabelText(/^Course or product/), 'p-1')
    expect(screen.getByRole('button', { name: 'Save to CRM' })).toBeEnabled()
  })

  it('lets a rep name a product the catalogue does not carry', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<SaveLeadCard {...base} chat={null} onSave={onSave} />)
    await fillRequired(user)
    await user.selectOptions(screen.getByLabelText(/^Course or product/), '__other__')
    // Choosing "Something else…" alone is not an answer.
    expect(screen.getByRole('button', { name: 'Save to CRM' })).toBeDisabled()

    await user.type(screen.getByLabelText(/^Which product/), 'Weekend revision batch')
    await user.click(screen.getByRole('button', { name: 'Save to CRM' }))
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ product: 'Weekend revision batch', productId: null }),
    )
  })

  it('reports the catalogue id when the product came from the catalogue', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<SaveLeadCard {...base} chat={null} onSave={onSave} />)
    await fillRequired(user)
    await user.selectOptions(screen.getByLabelText(/^Source/), 'referral')
    await user.click(screen.getByRole('button', { name: 'Save to CRM' }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      product: 'NEET Crash Course',
      productId: 'p-1',
      channel: 'referral',
      estValue: 48000,
      stageId: 's-1',
    }))
  })

  it('shows the rep the exact row before it exists', async () => {
    const user = userEvent.setup()
    render(<SaveLeadCard {...base} chat={chat} />)
    await user.selectOptions(screen.getByLabelText(/^Course or product/), 'p-1')
    // Scoped to the summary: the product name is also an <option>, and matching
    // that would pass even if the receipt never rendered.
    const summary = within(screen.getByLabelText('What will be saved'))
    expect(summary.getByText('Anjali Rao')).toBeInTheDocument()
    expect(summary.getByText('+919876543210')).toBeInTheDocument()
    expect(summary.getByText('NEET Crash Course')).toBeInTheDocument()
    expect(summary.getByText('WhatsApp')).toBeInTheDocument()
  })

  it('copies the open WhatsApp chat in on one tap, and marks the source', async () => {
    const user = userEvent.setup()
    render(<SaveLeadCard {...base} chat={null} openChat={chat} />)
    await user.click(screen.getByRole('button', { name: /Use open chat — Anjali Rao/ }))
    expect(screen.getByLabelText(/^Name/)).toHaveValue('Anjali Rao')
    expect(screen.getByLabelText(/^Phone/)).toHaveValue('+919876543210')
    expect(screen.getByLabelText(/^Source/)).toHaveValue('whatsapp')
  })

  it('offers no chat shortcut when WhatsApp has nothing open', () => {
    render(<SaveLeadCard {...base} chat={null} openChat={null} />)
    expect(screen.queryByRole('button', { name: /Use open chat/ })).not.toBeInTheDocument()
  })

  it('seeds a typed NAME into Name and a typed NUMBER into Phone', () => {
    const { unmount } = render(<SaveLeadCard {...base} chat={null} initialQuery="Meera" />)
    expect(screen.getByLabelText(/^Name/)).toHaveValue('Meera')
    expect(screen.getByLabelText(/^Phone/)).toHaveValue('+91')
    unmount()

    render(<SaveLeadCard {...base} chat={null} initialQuery="+9198765 43210" />)
    expect(screen.getByLabelText(/^Phone/)).toHaveValue('+9198765 43210')
  })
})
