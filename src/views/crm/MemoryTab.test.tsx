import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LeadItem } from '../../lib/leads-data'

const { from } = vi.hoisted(() => ({
  from: vi.fn(),
}))

vi.mock('../../lib/supabase', () => ({
  supabase: { from },
}))

const { MemoryTab } = await import('./MemoryTab')

const sampleLead: LeadItem = {
  id: 'lead-1',
  contact_id: 'contact-1',
  conversation_id: 'conv-1',
  stage_id: 'stage-1',
  status: 'open',
  est_value: 60000,
  temperature_override: null,
  next_action: null,
  objection: null,
  lost_reason: null,
  updated_at: '2026-08-10T09:00:00Z',
  contact: {
    profile_name: 'Asha Patel',
    channel: 'whatsapp',
    external_id: '919947638424',
  },
  conversation: {
    assigned_to: 'user-1',
    last_customer_message_at: '2026-08-10T09:00:00Z',
  },
}

describe('MemoryTab in LeadDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders honest empty state when no facts exist', async () => {
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    from.mockReturnValue(chain)

    render(<MemoryTab clientId="client-1" lead={sampleLead} />)

    await waitFor(() => {
      expect(screen.getByText('No customer facts extracted yet.')).toBeInTheDocument()
    })
  })

  it('renders extracted facts from contact and conversation data', async () => {
    const contactChain = {
      select: vi.fn(() => contactChain),
      eq: vi.fn(() => contactChain),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          profile_name: 'Asha Patel',
          channel: 'whatsapp',
          external_id: '919947638424',
          profile: null,
          is_opted_out: false,
          captured_fields: { target_batch: 'NEET evening crash course' },
        },
        error: null,
      }),
    }
    const convChain = {
      select: vi.fn(() => convChain),
      eq: vi.fn(() => convChain),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: 'conv-1',
          contact_id: 'contact-1',
          status: 'open',
          bot_paused: false,
          unread_count: 0,
          last_customer_message_at: '2026-08-10T09:00:00Z',
          last_bot_message_at: null,
          escalation_resolved: true,
          assigned_to: 'user-1',
          rolling_summary: null,
          summary_upto: null,
          extracted_fields: { fee_budget: '₹60,000 in 2 instalments' },
        },
        error: null,
      }),
    }

    from.mockImplementation((table: string) => {
      if (table === 'contacts') return contactChain
      if (table === 'conversations') return convChain
      throw new Error(`unexpected table: ${table}`)
    })

    render(<MemoryTab clientId="client-1" lead={sampleLead} />)

    await waitFor(() => {
      expect(screen.getByText('NEET evening crash course')).toBeInTheDocument()
      expect(screen.getByText('₹60,000 in 2 instalments')).toBeInTheDocument()
    })
  })
})
