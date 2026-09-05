import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SaveLeadCard } from './SaveLeadCard'

const stages = [{ id: 's-1', label: 'New' }, { id: 's-2', label: 'Contacted' }]
const chat = { displayName: 'Anjali Rao', phoneE164: '+919876543210' }
const base = { stages, onSave: vi.fn() }

async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
  await user.clear(screen.getByLabelText(/^Phone/))
  await user.type(screen.getByLabelText(/^Phone/), '+919900112233')
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
    render(<SaveLeadCard {...base} chat={null} />)
    // Prefix only: create_manual_lead would otherwise mint a contact keyed '91'.
    expect(screen.getByRole('button', { name: 'Save to CRM' })).toBeDisabled()
  })

  it('saves once there is a real number', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<SaveLeadCard {...base} chat={null} onSave={onSave} />)
    await fillRequired(user)
    await user.selectOptions(screen.getByLabelText(/^Source/), 'referral')
    await user.click(screen.getByRole('button', { name: 'Save to CRM' }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      phone: '+919900112233', channel: 'referral', stageId: 's-1',
    }))
  })

  it('carries the web modal’s field set, source included', () => {
    render(<SaveLeadCard {...base} chat={null} />)
    for (const label of [/^Name/, /^Phone/, /^Source/, /^Stage/, /^Next action/, /^Note/]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument()
    }
    expect(screen.getByLabelText('Estimated value')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Walk-in / In-person' })).toBeInTheDocument()
    expect(screen.queryByLabelText(/product/i)).not.toBeInTheDocument()
  })

  it('shows the rep the exact row before it exists', () => {
    render(<SaveLeadCard {...base} chat={chat} />)
    const summary = within(screen.getByLabelText('What will be saved'))
    expect(summary.getByText('Anjali Rao')).toBeInTheDocument()
    expect(summary.getByText('+919876543210')).toBeInTheDocument()
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

  it('leaves Name empty when the unsaved chat header is the number itself', () => {
    const numericChat = { displayName: '+91 90000 11122', phoneE164: '+919000011122' }
    render(<SaveLeadCard {...base} chat={numericChat} />)
    expect(screen.getByLabelText(/^Name/)).toHaveValue('')
    expect(screen.getByLabelText(/^Phone/)).toHaveValue('+919000011122')
  })
})
