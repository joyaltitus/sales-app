import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// SetTargetForm and TargetsPage write the SAME employee_targets row, upserting
// on (client_id, user_id, month). This form used to send `Number(x) || 0`, so
// any value it could not read landed as a literal 0 over the rep's real target.
// Both editors now share parseMoney, and these tests hold that line.
const { upsertTarget } = vi.hoisted(() => ({ upsertTarget: vi.fn() }))
vi.mock('../../lib/targets-data', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/targets-data')>()),
  useTeamTargets: () => ({ items: [], loading: false, reload: vi.fn() }),
  upsertTarget,
}))

const { SetTargetForm } = await import('./TodosTab')

const props = {
  clientId: 'c-1',
  createdBy: 'u-manager',
  roster: [{ user_id: 'u-rep', display_name: 'Anjali Rao' }],
}

function saveButton() {
  return screen.getByRole('button', { name: /target/i })
}

describe('SetTargetForm money handling', () => {
  beforeEach(() => upsertTarget.mockReset().mockResolvedValue({ ok: true }))

  it('refuses a negative target instead of upserting it', async () => {
    render(<SetTargetForm {...props} />)
    await userEvent.type(screen.getByLabelText('Target value'), '-250000')

    expect(screen.getByLabelText('Target value')).toHaveAttribute('aria-invalid', 'true')
    expect(saveButton()).toBeDisabled()
    await userEvent.click(saveButton())
    expect(upsertTarget).not.toHaveBeenCalled()
  })

  // Honest note: the field is type="number", so neither jsdom nor a browser ever
  // holds "abc" — it sanitizes to "". This pins the blank path, and passed before
  // the fix too. The junk a number input DOES hand you is the negative above.
  it('never lets an unreadable target reach the upsert', async () => {
    render(<SetTargetForm {...props} />)
    await userEvent.type(screen.getByLabelText('Target value'), 'abc')

    expect(saveButton()).toBeDisabled()
    await userEvent.click(saveButton())
    expect(upsertTarget).not.toHaveBeenCalled()
  })

  it('refuses a typed-but-unreadable payout rather than silently sending zero', async () => {
    render(<SetTargetForm {...props} />)
    await userEvent.type(screen.getByLabelText('Target value'), '250000')
    expect(saveButton()).toBeEnabled()

    await userEvent.type(screen.getByLabelText('Incentive per won'), '-5')

    expect(saveButton()).toBeDisabled()
    await userEvent.click(saveButton())
    expect(upsertTarget).not.toHaveBeenCalled()
  })

  it('keeps Save shut while the target is blank', () => {
    render(<SetTargetForm {...props} />)
    expect(saveButton()).toBeDisabled()
  })

  it('saves a real target, defaulting the blank payout fields to zero', async () => {
    render(<SetTargetForm {...props} />)
    await userEvent.type(screen.getByLabelText('Target value'), '250000')
    await userEvent.click(saveButton())

    expect(upsertTarget).toHaveBeenCalledWith(expect.objectContaining({
      clientId: 'c-1',
      userId: 'u-rep',
      targetValue: 250_000,
      incentivePerWon: 0,
      bonusAtTarget: 0,
      createdBy: 'u-manager',
    }))
  })
})
