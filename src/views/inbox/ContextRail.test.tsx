import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { QueueItem } from '../../lib/inbox-data'

const PIXELLEDU_ID = 'cc4a7484-064e-495c-b611-b5ca105410f7'
const CONVERSATION_ID = '6913f0f5-5e04-41a8-9808-bd755b372bfc'
const SUMMARY_TEXT = 'PixellEdu asked about the two-part fee plan.'
const SUMMARY_UPTO = '2026-08-06T10:00:00Z'
const CUSTOMER_AT = '2026-08-05T09:30:00Z'

const {
  fetchInsight,
  setBotPaused,
  assignConversation,
  addFollowUp,
  addNote,
  deleteNote,
  moveLeadStage,
  followUpsState,
} = vi.hoisted(() => ({
  fetchInsight: vi.fn(),
  setBotPaused: vi.fn(),
  assignConversation: vi.fn(),
  addFollowUp: vi.fn(),
  addNote: vi.fn(),
  deleteNote: vi.fn(),
  moveLeadStage: vi.fn(),
  followUpsState: [] as Array<{ id: string; contact_id: string; due_at: string; status: string; note: string }>,
}))

vi.mock('../../lib/api', () => ({ fetchInsight }))
vi.mock('../../lib/crm-actions', () => ({
  setBotPaused,
  assignConversation,
  addFollowUp,
  addNote,
  deleteNote,
}))
vi.mock('../../lib/leads-data', () => ({
  useLeadStages: () => ({ stages: [] }),
  useFollowUps: () => ({ items: followUpsState, reload: vi.fn() }),
  moveLeadStage,
}))
vi.mock('../../lib/crm-data', () => ({
  useConvLead: () => ({ lead: null, reload: vi.fn() }),
  useNotes: () => ({ items: [], reload: vi.fn() }),
  useTeammates: () => ({ items: [] }),
  teammateLabel: () => 'Teammate',
}))
vi.mock('../../auth/AuthProvider', () => ({
  useAuth: () => ({ session: { user: { id: 'user-1', email: 'rep@example.com' } } }),
}))

const { ContextRail } = await import('./ContextRail')

function queueItem(over: Partial<QueueItem> = {}): QueueItem {
  return {
    id: CONVERSATION_ID,
    contact_id: 'contact-1',
    status: 'open',
    bot_paused: false,
    unread_count: 1,
    last_customer_message_at: CUSTOMER_AT,
    last_bot_message_at: null,
    escalation_resolved: true,
    assigned_to: null,
    rolling_summary: null,
    summary_upto: null,
    contact: {
      profile_name: 'Asha',
      channel: 'whatsapp',
      external_id: '919947638424',
      profile: null,
      is_opted_out: false,
    },
    ...over,
  }
}

function renderRail(item: QueueItem) {
  return render(
    <MemoryRouter>
      <ContextRail
        clientId={PIXELLEDU_ID}
        item={item}
        onChanged={() => {}}
        onUseDraft={() => {}}
      />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  fetchInsight.mockReset()
  fetchInsight.mockResolvedValue({
    kind: 'ok',
    data: {
      summary: 'Generated summary',
      next_action: 'Call the lead',
      draft_reply: 'Hi!',
      rationale: null,
    },
  })
  followUpsState.splice(0, followUpsState.length)
})

describe('ContextRail AI summary (#18 — hydrate persisted rolling_summary)', () => {
  it('shows the persisted rolling_summary on thread open without generating', () => {
    renderRail(queueItem({ rolling_summary: SUMMARY_TEXT, summary_upto: SUMMARY_UPTO }))

    expect(screen.getByText(SUMMARY_TEXT)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Summarise conversation/i })).not.toBeInTheDocument()
    expect(fetchInsight).not.toHaveBeenCalled()
  })

  it('offers on-demand generation when rolling_summary is null', async () => {
    const user = userEvent.setup()
    renderRail(queueItem())

    const button = screen.getByRole('button', { name: /Summarise conversation/i })
    await user.click(button)
    expect(fetchInsight).toHaveBeenCalledWith(CONVERSATION_ID)
    expect(await screen.findByText('Generated summary')).toBeInTheDocument()
  })

  it('treats a summary as stale when a customer message arrived after summary_upto', () => {
    renderRail(
      queueItem({
        rolling_summary: SUMMARY_TEXT,
        summary_upto: SUMMARY_UPTO,
        last_customer_message_at: '2026-08-10T09:30:00Z',
      }),
    )

    expect(screen.queryByText(SUMMARY_TEXT)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Summarise conversation/i })).toBeInTheDocument()
  })

  it('does not auto-regenerate on handover when the persisted summary is fresh', () => {
    renderRail(
      queueItem({
        bot_paused: true,
        escalation_resolved: false,
        rolling_summary: SUMMARY_TEXT,
        summary_upto: SUMMARY_UPTO,
      }),
    )

    expect(fetchInsight).not.toHaveBeenCalled()
  })

  it('auto-generates on handover when the persisted summary is stale', async () => {
    renderRail(
      queueItem({
        bot_paused: true,
        escalation_resolved: false,
        rolling_summary: SUMMARY_TEXT,
        summary_upto: SUMMARY_UPTO,
        last_customer_message_at: '2026-08-10T09:30:00Z',
      }),
    )

    await waitFor(() => expect(fetchInsight).toHaveBeenCalledWith(CONVERSATION_ID))
  })
})

describe('ContextRail Customer Memory (sales-app#21 S2)', () => {
  it('S2-AT-01: renders real extracted facts from conversation and contact data', () => {
    renderRail(
      queueItem({
        extracted_fields: {
          target_course: 'NEET evening batch',
          budget_limit: '60,000 INR',
        },
      }),
    )

    expect(screen.getByText('NEET evening batch')).toBeInTheDocument()
    expect(screen.getByText('60,000 INR')).toBeInTheDocument()
    expect(screen.queryByText('NEET repeater batch, evening only')).not.toBeInTheDocument()
  })

  it('S2-AT-02: two conversations show independent sets of memory cards', () => {
    const { unmount } = renderRail(
      queueItem({
        id: 'conv-a',
        extracted_fields: { pref: 'Saturday classes only' },
      }),
    )
    expect(screen.getByText('Saturday classes only')).toBeInTheDocument()
    unmount()

    renderRail(
      queueItem({
        id: 'conv-b',
        extracted_fields: { pref: 'Weekday morning batch' },
      }),
    )
    expect(screen.getByText('Weekday morning batch')).toBeInTheDocument()
    expect(screen.queryByText('Saturday classes only')).not.toBeInTheDocument()
  })

  it('S2-AT-03: shows honest empty state when no extracted facts exist', () => {
    renderRail(queueItem({ extracted_fields: null }))

    expect(screen.getByText('No customer facts extracted yet.')).toBeInTheDocument()
    expect(screen.queryByText('NEET repeater batch, evening only')).not.toBeInTheDocument()
  })

  it('displays Overdue badge when a pending follow-up is past its due date', () => {
    followUpsState.push({
      id: 'fu-1',
      contact_id: 'contact-1',
      due_at: '2026-08-01T09:00:00Z',
      status: 'pending',
      note: 'Call back about scholarship',
    })
    renderRail(queueItem())

    expect(screen.getByText('Overdue')).toBeInTheDocument()
    expect(screen.getByText(/Call back about scholarship/)).toBeInTheDocument()
  })
})
