import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

// The widget block only needs the campaigns tab's PREVIEW path, which calls no
// hook with a real client id. `channel_accounts` is still read through the
// mocked client, so the "no number yet" branch is what a bare mock produces —
// which is the branch worth proving, since a broken wa.me link would go on a
// customer's website.
const { from } = vi.hoisted(() => ({ from: vi.fn() }))
vi.mock('../../lib/supabase', () => ({ supabase: { from, rpc: vi.fn() } }))

const { CampaignsTab, waLink, waDigits, floatingButtonSnippet } = await import('./CampaignsTab')
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
    spend_minor: 0,
    trigger: { code_keywords: ['diwali'], ctwa_source_ids: [] },
    ...over,
  } as Campaign
}

const props = { clientId: 'c-1', userId: 'u-1', names: new Map<string, string>() }

describe('the wa.me widget', () => {
  it('strips the number to bare digits — wa.me rejects anything else', () => {
    expect(waDigits('+91 98765 43210')).toBe('919876543210')
  })

  it('pre-types the code word, which is what makes the lead attributable', () => {
    expect(waLink('+91 98765 43210', 'diwali')).toBe('https://wa.me/919876543210?text=diwali')
  })

  it('escapes a code word that would otherwise break the query string', () => {
    expect(waLink('919876543210', 'diwali offer&x')).toContain('text=diwali%20offer%26x')
  })

  it('builds a paste-anywhere button with no dependency and no build step', () => {
    const html = floatingButtonSnippet('https://wa.me/919876543210?text=diwali')
    expect(html).toContain('https://wa.me/919876543210?text=diwali')
    expect(html).toContain('position:fixed')
    expect(html).toContain("rel = 'noopener'")
    expect(html).not.toMatch(/<script src=/)
  })

  it('says the number is missing instead of rendering a dead link', () => {
    render(<CampaignsTab {...props} preview={[campaign()]} />)
    expect(screen.getByText(/WhatsApp number is not filled in yet/i)).toBeInTheDocument()
  })

  it('offers nothing at all for a campaign with no code word — there is nothing to attribute', () => {
    render(<CampaignsTab {...props} preview={[campaign({ trigger: { code_keywords: [], ctwa_source_ids: [] } })]} />)
    expect(screen.queryByText(/Put this campaign on your website/i)).not.toBeInTheDocument()
  })
})
