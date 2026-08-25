import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { CallOutcome } from '../lib/contracts'
import { objectionTaxonomy, stageOptions } from '../fixtures'
import { OutcomeBar } from './OutcomeBar'

const FIVE: CallOutcome[] = ['closed', 'progressing', 'objection', 'no_answer', 'callback']

function setup() {
  const props = {
    stages: stageOptions,
    stageKey: 'proposal',
    status: 'open' as const,
    taxonomy: objectionTaxonomy,
    onOutcome: vi.fn(),
    onStageChange: vi.fn(),
    onStatusChange: vi.fn(),
    onFollowUpChange: vi.fn(),
    onSaveNote: vi.fn(),
    onObjection: vi.fn(),
  }
  render(<OutcomeBar {...props} />)
  return props
}

describe('OutcomeBar', () => {
  it('exposes exactly five outcome options — the frozen CallOutcome space', () => {
    setup()
    const buttons = screen.getAllByRole('button', { name: /.+/ })
      .filter((el) => el.hasAttribute('data-outcome'))
    expect(buttons).toHaveLength(5)
    expect(buttons.map((b) => b.getAttribute('data-outcome'))).toEqual(FIVE)
  })

  it.each(FIVE)('one tap on %s fires the callback immediately', async (outcome) => {
    const props = setup()
    await userEvent.click(screen.getByRole('button', { name: new RegExp(outcome.replace('_', ' '), 'i') }))
    expect(props.onOutcome).toHaveBeenCalledWith(outcome)
  })

  it('changes stage and status through the selects', async () => {
    const props = setup()
    await userEvent.selectOptions(screen.getByLabelText('Stage'), 'negotiation')
    expect(props.onStageChange).toHaveBeenCalledWith('negotiation')
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'won')
    expect(props.onStatusChange).toHaveBeenCalledWith('won')
  })

  it('follow-up date change emits ISO value; clear emits null', async () => {
    const props = setup()
    const input = screen.getByLabelText('Follow-up date')
    await userEvent.type(input, '2026-09-01')
    expect(props.onFollowUpChange).toHaveBeenLastCalledWith('2026-09-01')
    await userEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(props.onFollowUpChange).toHaveBeenLastCalledWith(null)
  })

  it('save note is gated on non-empty text and clears after saving', async () => {
    const props = setup()
    const save = screen.getByRole('button', { name: 'Save note' })
    expect(save).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Note'), 'Wants weekend visit')
    await userEvent.click(save)
    expect(props.onSaveNote).toHaveBeenCalledWith('Wants weekend visit')
    expect(save).toBeDisabled()
  })

  it('objection log requires picking a taxonomy first', async () => {
    const props = setup()
    const log = screen.getByRole('button', { name: 'Log' })
    expect(log).toBeDisabled()
    await userEvent.selectOptions(screen.getByLabelText('Objection type'), 'price')
    await userEvent.click(log)
    expect(props.onObjection).toHaveBeenCalledWith('price')
  })
})
