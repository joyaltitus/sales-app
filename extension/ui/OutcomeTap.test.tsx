import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { CallOutcome } from '../lib/contracts'
import { objectionTaxonomy } from '../fixtures'
import { OutcomeTap } from './OutcomeTap'

const FIVE: CallOutcome[] = ['closed', 'progressing', 'objection', 'no_answer', 'callback']

function setup() {
  const props = {
    taxonomy: objectionTaxonomy,
    onOutcome: vi.fn(),
    onFollowUpChange: vi.fn(),
  }
  render(<OutcomeTap {...props} />)
  return props
}

describe('OutcomeTap', () => {
  it('still exposes exactly five outcomes — the frozen CallOutcome space', () => {
    setup()
    const buttons = screen.getAllByRole('button').filter((el) => el.hasAttribute('data-outcome'))
    expect(buttons.map((b) => b.getAttribute('data-outcome'))).toEqual(FIVE)
  })

  // AT-07 — the three that mean the call connected are large, and each is ONE tap.
  it.each(['closed', 'progressing', 'objection'] as const)('%s logs in a single tap', async (outcome) => {
    const props = setup()
    const button = screen.getByRole('button', { name: new RegExp(outcome, 'i') })
    // Large: the reflex taps below them are min-h-11.
    expect(button.className).toMatch(/min-h-16/)
    await userEvent.click(button)
    expect(props.onOutcome).toHaveBeenCalledTimes(1)
    expect(props.onOutcome).toHaveBeenCalledWith(outcome, outcome === 'objection' ? 'price' : undefined)
  })

  // AT-08 — no date to type between the outcome and the follow-up.
  it('locks a follow-up one tap from the outcome', async () => {
    const props = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Progressing' }))
    await userEvent.click(screen.getByRole('button', { name: 'Tomorrow' }))
    expect(props.onFollowUpChange).toHaveBeenCalledTimes(1)
    expect(props.onFollowUpChange.mock.calls[0]![0]).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(screen.getByRole('button', { name: 'Tomorrow' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('a second tap on the same day clears it', async () => {
    const props = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Today' }))
    await userEvent.click(screen.getByRole('button', { name: 'Today' }))
    expect(props.onFollowUpChange).toHaveBeenLastCalledWith(null)
  })

  it('logs the objection type the rep actually chose', async () => {
    const props = setup()
    await userEvent.selectOptions(screen.getByLabelText('Objection type'), 'timing')
    await userEvent.click(screen.getByRole('button', { name: 'Objection' }))
    expect(props.onOutcome).toHaveBeenCalledWith('objection', 'timing')
  })

  // AT-09 — the point of the rewrite. The form is gone, not renamed.
  it('carries no form: no note, no stage, no status, no date field', () => {
    setup()
    expect(screen.queryByLabelText('Note')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Stage')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Status')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Follow-up date')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save note' })).not.toBeInTheDocument()
  })
})
