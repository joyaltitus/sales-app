import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { from } = vi.hoisted(() => ({
  from: vi.fn(),
}))

vi.mock('./supabase', () => ({
  supabase: { from },
}))

const { useTeammates, teammateLabel, useConvLead } = await import('./crm-data')

function makeChain(result: unknown) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => Promise.resolve(result)),
  }
  return builder
}

describe('crm-data S1 polish tests (sales-app#21)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('useTeammates & teammateLabel (AT-08)', () => {
    it('joins profiles display names client-side for teammates', async () => {
      const membershipsBuilder = makeChain({
        data: [{ user_id: 'user-1', role: 'agent' }, { user_id: 'user-2', role: 'manager' }],
        error: null,
      })
      const profilesBuilder = makeChain({
        data: [{ user_id: 'user-1', display_name: 'Asha Patel' }],
        error: null,
      })

      from.mockImplementation((table: string) => {
        if (table === 'user_client_memberships') return membershipsBuilder
        if (table === 'profiles') return profilesBuilder
        throw new Error(`unexpected table ${table}`)
      })

      const { result } = renderHook(() => useTeammates('client-1'))
      await waitFor(() => expect(result.current.items).toHaveLength(2))

      expect(result.current.items[0]).toEqual({
        user_id: 'user-1',
        role: 'agent',
        displayName: 'Asha Patel',
      })
      expect(teammateLabel(result.current.items[0])).toBe('Asha Patel')

      // user-2 has no profile display_name -> falls back to Role · id prefix
      expect(result.current.items[1]).toEqual({
        user_id: 'user-2',
        role: 'manager',
        displayName: null,
      })
      expect(teammateLabel(result.current.items[1])).toBe('manager · user')
    })
  })

  describe('useConvLead (AT-06)', () => {
    it('queries next_action from leads table', async () => {
      const leadBuilder = makeChain({
        data: [
          {
            id: 'lead-1',
            contact_id: 'contact-1',
            conversation_id: 'conv-1',
            stage_id: 'stage-1',
            status: 'open',
            est_value: 60000,
            temperature_override: null,
            objection: null,
            next_action: 'Hold slot and follow up tomorrow',
          },
        ],
        error: null,
      })

      from.mockReturnValue(leadBuilder)

      const { result } = renderHook(() => useConvLead('client-1', 'contact-1'))
      await waitFor(() => expect(result.current.lead).not.toBeNull())

      expect(result.current.lead?.next_action).toBe('Hold slot and follow up tomorrow')
      expect(leadBuilder.select).toHaveBeenCalledWith(expect.stringContaining('next_action'))
    })
  })
})
