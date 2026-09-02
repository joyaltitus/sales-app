import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// UI-side edge cases the data-layer tests cannot reach: the optimistic
// rollback when the manager wall refuses a write, and the promote concurrency
// notice. Both are moments where showing the wrong thing is worse than failing.

const { setSalesConfigMock } = vi.hoisted(() => ({ setSalesConfigMock: vi.fn() }))

vi.mock('../../../lib/sales-settings-data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/sales-settings-data')>()
  return { ...actual, setSalesConfig: setSalesConfigMock }
})

const { SettingsView } = await import('./SettingsView')
const { isConcurrencyError, winRateLabel } = await import('./shared')
const { SALES_CONFIG_DEFAULTS } = await import('../../../lib/sales-settings-data')

beforeEach(() => {
  setSalesConfigMock.mockReset()
})

describe('winRateLabel', () => {
  it('refuses to print a percentage below ten rated uses', () => {
    expect(winRateLabel({ uses: 40, rated: 2, won: 1 }).text).toBe('early · 2')
  })

  it('prints the percentage and the honest denominator once there is enough', () => {
    expect(winRateLabel({ uses: 30, rated: 24, won: 17 }).text).toBe('71% · 24 rated')
  })

  it('calls a used-but-never-rated version untested rather than 0%', () => {
    expect(winRateLabel({ uses: 12, rated: 0, won: 0 }).text).toBe('untested')
    expect(winRateLabel(undefined).text).toBe('untested')
  })

  it('tones a losing script warn and a winning one success', () => {
    expect(winRateLabel({ uses: 20, rated: 20, won: 18 }).tone).toBe('success')
    expect(winRateLabel({ uses: 20, rated: 20, won: 2 }).tone).toBe('warn')
  })
})

describe('isConcurrencyError', () => {
  // ★ pm_promote_script_version raises 40001 "script … moved on: expected
  // standard …, found …". That is never a blind retry.
  it('recognises the RPC concurrency raise', () => {
    expect(
      isConcurrencyError('script a0de moved on: expected standard b1, found c2'),
    ).toBe(true)
  })

  it('does not mistake an ordinary failure for it', () => {
    expect(isConcurrencyError('permission denied for table script_versions')).toBe(false)
    expect(isConcurrencyError(null)).toBe(false)
  })
})

describe('SettingsView', () => {
  const baseProps = {
    clientId: 'client-1',
    scripts: [],
    course: null,
    clientName: 'Vidya Sagar Academy',
    reload: () => {},
  }

  // ★ A rep hitting the manager wall must see the sentence AND see the field
  // snap back — an optimistic value left on screen is a lie about what saved.
  it('rolls the optimistic change back and shows "Managers only" when the wall refuses', async () => {
    setSalesConfigMock.mockResolvedValue({ ok: false, message: 'Managers only — ask an admin to change this.' })
    const setConfig = vi.fn()
    const config = { ...SALES_CONFIG_DEFAULTS, languages: ['en', 'mn'], tokenAmount: 500 }

    render(<SettingsView {...baseProps} config={config} setConfig={setConfig} />)

    await userEvent.click(screen.getByRole('button', { name: 'Hindi' }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Managers only'))
    // Applied optimistically first, then put back exactly as it was.
    expect(setConfig).toHaveBeenNthCalledWith(1, expect.objectContaining({ languages: ['en', 'mn', 'hi'] }))
    expect(setConfig).toHaveBeenLastCalledWith(config)
  })

  it('refuses a non-https payment link before it ever reaches the RPC', async () => {
    const setConfig = vi.fn()
    render(<SettingsView {...baseProps} config={SALES_CONFIG_DEFAULTS} setConfig={setConfig} />)

    const input = screen.getByLabelText(/Payment link/i)
    await userEvent.type(input, 'http://pay.example.com')
    await userEvent.tab()

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('must start with https://'))
    expect(setSalesConfigMock).not.toHaveBeenCalled()
  })

  it('never lets English be switched off — every base body is written in it', () => {
    render(<SettingsView {...baseProps} config={SALES_CONFIG_DEFAULTS} setConfig={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'English' })).toBeDisabled()
  })
})
