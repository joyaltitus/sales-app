import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const TENANT = 'a0de0000-0000-4000-8000-000000000001'
const USER = '11111111-1111-4111-8111-111111111111'

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../../lib/supabase', () => ({ supabase: { rpc, from: vi.fn() } }))

const { LeadSources, embedSnippet, curlSnippet } = await import('./LeadSources')
import type { IntakeSource } from './LeadSources'

function source(over: Partial<IntakeSource> = {}): IntakeSource {
  return {
    id: 'cc10d5db-0000-4000-8000-000000000001',
    source_key: 'site_form',
    display_name: 'Website enquiry form',
    mode: 'sandbox',
    active: false,
    key_last4: '',
    key_rotated_at: null,
    phone_field_path: 'phone',
    first_touch_template_id: null,
    daily_first_touch_cap: 50,
    owner_pool: [USER],
    door: 'form',
    slug: 'vidya-sagar-demo',
    ...over,
  }
}

const names = new Map([[USER, 'Asha']])
const props = { clientId: TENANT, userId: USER, names }

beforeEach(() => rpc.mockReset())

describe('Lead sources', () => {
  it('shows what still blocks a source from going live, in plain language', () => {
    render(<LeadSources {...props} preview={[source()]} />)
    // The template is the one unset requirement in this fixture.
    expect(screen.getByText('not set')).toBeInTheDocument()
    expect(screen.getByText('Asha')).toBeInTheDocument()
    expect(screen.getByText('Not live')).toBeInTheDocument()
  })

  it('gives the form door a link and a paste-in embed, not an API URL', () => {
    render(<LeadSources {...props} preview={[source()]} />)
    expect(screen.getByText(/\/f\/vidya-sagar-demo/)).toBeInTheDocument()
    expect(screen.getByText(/embed\/v1\/vidya-sagar-demo/)).toBeInTheDocument()
    expect(screen.queryByText(/v1\/intake\/leads/)).not.toBeInTheDocument()
  })

  it('shows the plain-POST URL for an API source', () => {
    render(<LeadSources {...props} preview={[source({ door: 'api', slug: null })]} />)
    expect(screen.getByText(/v1\/intake\/leads/)).toBeInTheDocument()
  })

  it('shows a new key exactly once, with the warning that it will not come back', async () => {
    const user = userEvent.setup()
    rpc.mockResolvedValueOnce({ data: 'ik_deadbeef', error: null })
    render(<LeadSources {...props} preview={[source({ door: 'api', slug: null })]} />)

    await user.click(screen.getByRole('button', { name: /Create key/i }))

    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith('pm_intake_rotate_key', {
        p_client_id: TENANT,
        p_source_config_id: source().id,
        p_auth_user_id: USER,
      }),
    )
    expect(screen.getByText('ik_deadbeef')).toBeInTheDocument()
    expect(screen.getByText(/never shown again/i)).toBeInTheDocument()
    // The curl is built with the real key, so a paste of it actually works.
    expect(screen.getByText(/Bearer ik_deadbeef/)).toBeInTheDocument()
  })

  it('reports the rotate refusal instead of pretending a key was issued', async () => {
    const user = userEvent.setup()
    // The RPC RAISES on a non-admin caller, so it arrives as an error, not a body.
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'client_admin required' } })
    render(<LeadSources {...props} preview={[source()]} />)

    await user.click(screen.getByRole('button', { name: /Create key/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('client_admin required')
  })

  it('names the activation refusal the database gave', async () => {
    const user = userEvent.setup()
    rpc.mockResolvedValueOnce({ data: { ok: false, reason: 'template_required' }, error: null })
    render(<LeadSources {...props} preview={[source()]} />)

    await user.click(screen.getByRole('button', { name: 'Go live' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('template_required')
    expect(screen.getByText(/No first-touch template is attached/i)).toBeInTheDocument()
  })

  it('names Lead Ads as not built yet rather than leaving it out', () => {
    render(<LeadSources {...props} preview={[]} />)
    expect(screen.getByText(/Lead Ads/i)).toBeInTheDocument()
    expect(screen.getByText('Not connected yet')).toBeInTheDocument()
  })
})

describe('snippets', () => {
  it('embeds the hosted form by slug and never inlines a key', () => {
    const html = embedSnippet('https://hub.example', 'vidya-sagar-demo')
    expect(html).toContain('https://hub.example/embed/v1/vidya-sagar-demo')
    expect(html).not.toContain('ik_')
  })

  it('sends the key as a bearer header, not in the URL', () => {
    const curl = curlSnippet('https://hub.example', 'ik_abc')
    expect(curl).toContain("authorization: Bearer ik_abc")
    expect(curl).toContain('https://hub.example/v1/intake/leads')
    expect(curl).not.toContain('?key=')
  })
})
