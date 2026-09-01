import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { VoiceCard } from './VoiceCard'

const fields = [
  { key: 'outcome', label: 'Outcome', value: 'callback' },
  { key: 'follow_up', label: 'Follow-up date', value: '2026-08-27' },
]

describe('VoiceCard', () => {
  it('renders idle state with record button', () => {
    render(<VoiceCard proposedFields={fields} transcript={null} onApprove={vi.fn()} onDiscard={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Start recording' })).toBeInTheDocument()
    expect(screen.getByText(/You review the draft before anything is saved/)).toBeInTheDocument()
  })

  it('shows recording state and toggles the aria-pressed button', async () => {
    const onRecordPress = vi.fn()
    render(
      <VoiceCard recording proposedFields={fields} transcript={null} onRecordPress={onRecordPress} onApprove={vi.fn()} onDiscard={vi.fn()} />,
    )
    const record = screen.getByRole('button', { name: 'Stop recording' })
    expect(record).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(/Recording…/)).toBeInTheDocument()
    await userEvent.click(record)
    expect(onRecordPress).toHaveBeenCalledOnce()
  })

  it('displays the transcript', () => {
    render(<VoiceCard proposedFields={[]} transcript="Call went well, ring Friday" onApprove={vi.fn()} onDiscard={vi.fn()} />)
    expect(screen.getByText(/Call went well, ring Friday/)).toBeInTheDocument()
  })

  it('proposed fields are editable and approve returns the edited draft', async () => {
    const onApprove = vi.fn()
    render(<VoiceCard proposedFields={fields} transcript={null} onApprove={onApprove} onDiscard={vi.fn()} />)

    const followUp = screen.getByLabelText('Proposed Follow-up date')
    await userEvent.clear(followUp)
    await userEvent.type(followUp, '2026-09-02')
    await userEvent.click(screen.getByRole('button', { name: 'Approve' }))

    expect(onApprove).toHaveBeenCalledWith({ outcome: 'callback', follow_up: '2026-09-02' })
  })

  it('discard fires without writing anything', async () => {
    const onDiscard = vi.fn()
    render(<VoiceCard proposedFields={fields} transcript="x" onApprove={vi.fn()} onDiscard={onDiscard} />)
    await userEvent.click(screen.getByRole('button', { name: 'Discard' }))
    expect(onDiscard).toHaveBeenCalledOnce()
  })

  it('re-syncs the draft when new fields are proposed', async () => {
    const { rerender } = render(
      <VoiceCard proposedFields={fields} transcript={null} onApprove={vi.fn()} onDiscard={vi.fn()} />,
    )
    rerender(
      <VoiceCard
        proposedFields={[...fields, { key: 'note', label: 'Note', value: 'Ring after 5' }]}
        transcript={null}
        onApprove={vi.fn()}
        onDiscard={vi.fn()}
      />,
    )
    expect(screen.getByLabelText('Proposed Note')).toHaveValue('Ring after 5')
  })

  it('re-syncs when a later proposal reuses the same field keys', () => {
    const { rerender } = render(
      <VoiceCard proposedFields={fields} transcript={null} onApprove={vi.fn()} onDiscard={vi.fn()} />,
    )
    rerender(
      <VoiceCard
        proposedFields={fields.map((field) => field.key === 'outcome' ? { ...field, value: 'closed' } : field)}
        transcript={null}
        onApprove={vi.fn()}
        onDiscard={vi.fn()}
      />,
    )
    expect(screen.getByLabelText('Proposed Outcome')).toHaveValue('closed')
  })
})
