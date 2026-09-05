import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MOCK_GO_LIVE } from '../preview/preview-mocks'
import type { Rule } from '../../lib/manage-data'

// Two write paths sent a placeholder actor to the database when nobody was
// signed in: RulesTab an empty string, GoLive a null. Neither is a user, and
// both produced a refusal that read to the operator as "the write failed".
const TENANT = 'a0de0000-0000-4000-8000-000000000001'

const { rpc, editRuleResponse } = vi.hoisted(() => ({ rpc: vi.fn(), editRuleResponse: vi.fn() }))
let signedInUser: string | null = null

vi.mock('../../lib/supabase', () => ({ supabase: { rpc, from: vi.fn() } }))
vi.mock('../../shell/ClientProvider', () => ({ useClient: () => ({ activeClient: { id: TENANT } }) }))
vi.mock('../../auth/AuthProvider', () => ({
  useAuth: () => ({ session: signedInUser ? { user: { id: signedInUser } } : null }),
}))
vi.mock('../../lib/manage-data', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/manage-data')>()),
  editRuleResponse,
  useObjectionRules: () => ({ items: [rule()], loading: false, error: null, reload: vi.fn() }),
  useBundles: () => ({ items: [], loading: false, error: null, reload: vi.fn() }),
}))

const { RulesTab } = await import('./RulesTab')
const { GoLive } = await import('./GoLive')

function rule(): Rule {
  return {
    id: 'r-1',
    rule_key: 'obj_price',
    priority: 400,
    trigger_keywords: ['costly'],
    match_mode: 'any',
    response_text: 'We can talk about the fee.',
    media_bundle_key: null,
    active: true,
  }
}

beforeEach(() => {
  rpc.mockReset()
  editRuleResponse.mockReset().mockResolvedValue({ ok: true })
  signedInUser = null
})

describe('RulesTab actor guard', () => {
  it('does not send an empty string as the acting user', async () => {
    const user = userEvent.setup()
    render(<RulesTab clientId={TENANT} userId={null} names={new Map()} />)

    await user.clear(screen.getByRole('textbox'))
    await user.type(screen.getByRole('textbox'), 'A new reply')
    await user.click(screen.getByRole('button', { name: /save/i }))

    expect(editRuleResponse).not.toHaveBeenCalled()
  })

  it('still writes with a real user, passing that id through', async () => {
    const user = userEvent.setup()
    render(<RulesTab clientId={TENANT} userId="u-1" names={new Map()} />)

    await user.clear(screen.getByRole('textbox'))
    await user.type(screen.getByRole('textbox'), 'A new reply')
    await user.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => expect(editRuleResponse).toHaveBeenCalled())
    expect(editRuleResponse.mock.calls[0].at(-1)).toBe('u-1')
  })
})

describe('GoLive actor guard', () => {
  it('disables the confirm control instead of sending a null actor', async () => {
    rpc.mockResolvedValue({ data: MOCK_GO_LIVE, error: null })
    render(<GoLive />)

    const buttons = await screen.findAllByRole('button', { name: /mark done/i })
    expect(buttons.length).toBeGreaterThan(0)
    for (const button of buttons) expect(button).toBeDisabled()

    rpc.mockClear()
    await userEvent.setup().click(buttons[0])
    expect(rpc).not.toHaveBeenCalled()
  })

  it('leaves the control usable for a signed-in operator', async () => {
    signedInUser = '11111111-1111-4111-8111-111111111111'
    rpc.mockResolvedValue({ data: MOCK_GO_LIVE, error: null })
    render(<GoLive />)

    const buttons = await screen.findAllByRole('button', { name: /mark done/i })
    expect(buttons[0]).toBeEnabled()
  })
})
