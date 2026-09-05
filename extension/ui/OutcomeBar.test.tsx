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

  // FLIPPED (REG-015). The objection case used to expect the key 'price' —
  // taxonomy[0] — because the select seeded itself from the first entry. That
  // seeding is exactly the defect: a rep who never chose a reason had one
  // chosen for them, and it was attached to a real call. With nothing chosen
  // the key is now undefined, and App.tsx's existing guard tells the rep to
  // pick one instead of logging a reason they did not give.
  it.each(FIVE)('one tap on %s fires the callback immediately', async (outcome) => {
    const props = setup()
    await userEvent.click(screen.getByRole('button', { name: new RegExp(outcome.replace('_', ' '), 'i') }))
    expect(props.onOutcome).toHaveBeenCalledWith(...(outcome === 'objection' ? [outcome, undefined] : [outcome]))
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

  // FLIPPED (REG-015 + REG-018). This used to assert the defect: that the
  // select arrived pre-filled with taxonomy[0] and a second "Log" button was
  // immediately enabled. Both are gone — the placeholder is reachable, and the
  // objection reason now rides on the outcome that produced it.
  it('chooses no objection reason until the rep picks one', async () => {
    const props = setup()

    expect(screen.getByLabelText('Objection type')).toHaveValue('')
    expect(screen.queryByRole('button', { name: 'Log' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /objection/i }))
    expect(props.onOutcome).toHaveBeenCalledWith('objection', undefined)
    expect(props.onObjection).not.toHaveBeenCalled()
  })

  it('carries the chosen reason on the outcome, so it belongs to that call', async () => {
    const props = setup()

    await userEvent.selectOptions(screen.getByLabelText('Objection type'), 'timing')
    await userEvent.click(screen.getByRole('button', { name: /objection/i }))

    expect(props.onOutcome).toHaveBeenCalledWith('objection', 'timing')
  })

  it('keeps the placeholder reachable after a reason is chosen and cleared', async () => {
    setup()
    const select = screen.getByLabelText('Objection type')

    await userEvent.selectOptions(select, 'timing')
    expect(select).toHaveValue('timing')
    await userEvent.selectOptions(select, '')
    expect(select).toHaveValue('')
  })
})
