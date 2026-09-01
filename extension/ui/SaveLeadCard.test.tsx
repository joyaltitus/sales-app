import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SaveLeadCard } from './SaveLeadCard'

const stages = [{ id: 's-1', label: 'New' }, { id: 's-2', label: 'Contacted' }]
const chat = { displayName: 'Anjali Rao', phoneE164: '+919876543210' }

describe('SaveLeadCard', () => {
  it('prefills from the followed chat', () => {
    render(<SaveLeadCard chat={chat} stages={stages} onSave={vi.fn()} />)
    expect(screen.getByLabelText('Name')).toHaveValue('Anjali Rao')
    expect(screen.getByLabelText('Phone')).toHaveValue('+919876543210')
  })

  it('shows the rep the exact row before it exists', () => {
    render(<SaveLeadCard chat={chat} stages={stages} onSave={vi.fn()} />)
    expect(screen.getByText('WhatsApp (personal)')).toBeInTheDocument()
  })

  it('seeds a typed NAME into Name and a typed NUMBER into Phone', () => {
    const { unmount } = render(
      <SaveLeadCard chat={null} initialQuery="Meera" stages={stages} onSave={vi.fn()} />,
    )
    expect(screen.getByLabelText('Name')).toHaveValue('Meera')
    expect(screen.getByLabelText('Phone')).toHaveValue('')
    unmount()

    render(<SaveLeadCard chat={null} initialQuery="+9198765 43210" stages={stages} onSave={vi.fn()} />)
    expect(screen.getByLabelText('Name')).toHaveValue('')
    expect(screen.getByLabelText('Phone')).toHaveValue('+9198765 43210')
  })

  it('copies the open WhatsApp chat in on one tap', async () => {
    render(<SaveLeadCard chat={null} stages={stages} openChat={chat} onSave={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /Use open chat — Anjali Rao/ }))
    expect(screen.getByLabelText('Name')).toHaveValue('Anjali Rao')
    expect(screen.getByLabelText('Phone')).toHaveValue('+919876543210')
  })

  it('offers no chat shortcut when WhatsApp has nothing open', () => {
    render(<SaveLeadCard chat={null} stages={stages} openChat={null} onSave={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /Use open chat/ })).not.toBeInTheDocument()
  })

  it('will not save without a name, a number and a stage', async () => {
    const onSave = vi.fn()
    render(<SaveLeadCard chat={null} stages={stages} onSave={onSave} />)
    expect(screen.getByRole('button', { name: 'Save to CRM' })).toBeDisabled()

    await userEvent.type(screen.getByLabelText('Name'), 'Meera')
    await userEvent.type(screen.getByLabelText('Phone'), '+919900112233')
    await userEvent.click(screen.getByRole('button', { name: 'Save to CRM' }))
    expect(onSave).toHaveBeenCalledWith({
      name: 'Meera', phone: '+919900112233', interest: '', stageId: 's-1',
    })
  })
})
