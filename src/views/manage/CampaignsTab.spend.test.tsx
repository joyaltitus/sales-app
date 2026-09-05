import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

// Spend is the ROI denominator: every cost-per-lead and cost-per-sale number on
// the Attribution screen divides by it. `Number('')` is `0`, so an empty field
// used to parse as a real zero — which made the card dirty against any recorded
// spend and armed Save to overwrite it. These tests pin the empty field as "no
// value", not "zero".
const { from, rpc } = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }))
vi.mock('../../lib/supabase', () => ({ supabase: { from, rpc } }))

const { CampaignsTab, toMinor } = await import('./CampaignsTab')
import type { Campaign } from '../../lib/manage-data'

function campaign(over: Partial<Campaign> = {}): Campaign {
  return {
    id: 'ca-1',
    campaign_key: 'diwali_2026',
    name: 'Diwali offer',
    channel: 'meta_ads',
    context_text: null,
    starts_at: null,
    ends_at: null,
    active: true,
    spend_minor: 250_000,
    trigger: { code_keywords: [], ctwa_source_ids: [] },
    ...over,
  } as Campaign
}

const props = { clientId: 'c-1', userId: 'u-1', names: new Map<string, string>() }

describe('toMinor', () => {
  it('reads an empty field as no value, never as zero', () => {
    expect(toMinor('')).toBeNull()
    expect(toMinor('   ')).toBeNull()
  })

  it('still converts a real amount to paise', () => {
    expect(toMinor('2500')).toBe(250_000)
    expect(toMinor('0')).toBe(0)
  })

  it('refuses a negative or non-numeric amount', () => {
    expect(toMinor('-1')).toBeNull()
    expect(toMinor('abc')).toBeNull()
  })
})

describe('the spend field', () => {
  it('does not arm Save with zero when the field is cleared over a recorded spend', async () => {
    render(<CampaignsTab {...props} preview={[campaign()]} />)
    const save = screen.getByRole('button', { name: /save spend/i })
    expect(save).toBeDisabled()

    await userEvent.clear(screen.getByLabelText(/spend so far/i))

    expect(save).toBeDisabled()
    await userEvent.click(save)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('marks the cleared field invalid rather than accepting it as a number', async () => {
    render(<CampaignsTab {...props} preview={[campaign()]} />)
    const field = screen.getByLabelText(/spend so far/i)
    expect(field).toHaveAttribute('aria-invalid', 'false')

    await userEvent.clear(field)

    expect(field).toHaveAttribute('aria-invalid', 'true')
  })

  it('still arms Save for a real edit', async () => {
    render(<CampaignsTab {...props} preview={[campaign()]} />)
    await userEvent.type(screen.getByLabelText(/spend so far/i), '0')
    expect(screen.getByRole('button', { name: /save spend/i })).toBeEnabled()
  })
})
