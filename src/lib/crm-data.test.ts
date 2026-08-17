import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { from } = vi.hoisted(() => ({
  from: vi.fn(),
}))

vi.mock('./supabase', () => ({
  supabase: { from },
}))

const { useTeammates, teammateLabel, useConvLead, useLeadMemory } = await import('./crm-data')

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

  describe('useLeadMemory request sequencing', () => {
    it('does not let an older lead response replace the current lead facts', async () => {
      type Response = { data: Record<string, unknown> | null; error: { message: string } | null }
      const pending = new Map<string, (value: Response) => void>()
      from.mockImplementation((table: string) => {
        const chain = {
          select: vi.fn(() => chain),
          eq: vi.fn((_column: string, value: string) => {
            if (_column === 'id') chain.key = `${table}:${value}`
            return chain
          }),
          key: table,
          maybeSingle: vi.fn(() => new Promise<Response>((resolve) => pending.set(chain.key, resolve))),
        }
        return chain
      })

      const { result, rerender } = renderHook(
        ({ contactId }) => useLeadMemory('client-1', contactId, null),
        { initialProps: { contactId: 'contact-old' } },
      )
      await waitFor(() => expect(pending.has('contacts:contact-old')).toBe(true))
      rerender({ contactId: 'contact-new' })
      await waitFor(() => expect(pending.has('contacts:contact-new')).toBe(true))

      pending.get('contacts:contact-new')!({
        data: { channel: 'whatsapp', captured_fields: { interest: 'New lead fact' } }, error: null,
      })
      await waitFor(() => expect(result.current.facts[0]?.value).toBe('New lead fact'))
      pending.get('contacts:contact-old')!({
        data: { channel: 'whatsapp', captured_fields: { interest: 'Stale lead fact' } }, error: null,
      })

      await waitFor(() => expect(result.current.loading).toBe(false))
      expect(result.current.facts[0]?.value).toBe('New lead fact')
      expect(result.current.error).toBeNull()
    })

    it('clears facts and exposes Supabase errors', async () => {
      const chain = {
        select: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { message: 'RLS denied' } }),
      }
      from.mockReturnValue(chain)

      const { result } = renderHook(() => useLeadMemory('client-1', 'contact-1', null))
      await waitFor(() => expect(result.current.loading).toBe(false))
      expect(result.current.facts).toEqual([])
      expect(result.current.error).toBe('RLS denied')
    })
  })
})
