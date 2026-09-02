import type { QueueItem, Message } from '../../lib/inbox-data'
import type { Trace } from '../../lib/seam'

// Mock data for the /preview design gallery ONLY — the route is public, so
// nothing here may come from (or resemble) a live read. Names/numbers are the
// demo-tenant fiction (education vertical, SEED-01's world).

const min = (n: number) => new Date(Date.now() - n * 60_000).toISOString()

function q(
  id: string,
  name: string,
  channel: string,
  waitedMin: number,
  unread: number,
  extra: Partial<QueueItem> = {},
): QueueItem {
  return {
    id,
    contact_id: `c-${id}`,
    status: 'open',
    bot_paused: false,
    unread_count: unread,
    last_customer_message_at: min(waitedMin),
    last_bot_message_at: min(waitedMin + 2),
    escalation_resolved: false,
    assigned_to: null,
    rolling_summary: null,
    summary_upto: null,
    contact: {
      profile_name: name,
      channel,
      external_id: '+91 98470 12345',
      profile: null,
      is_opted_out: false,
    },
    ...extra,
  }
}

export const MOCK_QUEUE: { item: QueueItem; preview: string; assignee?: string | null }[] = [
  {
    item: q('1', 'Anjali Ramesh', 'whatsapp', 42, 2, { bot_paused: true }),
    preview: 'What is the fee if I pay in two parts?',
    assignee: 'You',
  },
  {
    item: q('2', 'Vishnu K', 'whatsapp', 12, 1),
    preview: 'शनिवार demo class free है क्या?',
  },
  {
    item: q('3', 'Fathima Noor', 'instagram', 4, 0),
    preview: 'ശനി batch-ന് seat available ആണോ?',
    assignee: 'Anil',
  },
  {
    item: q('4', 'Divya Menon', 'whatsapp', 1, 0),
    preview: 'Okay, thank you — will confirm tomorrow.',
  },
]

export const MOCK_MESSAGES: Message[] = [
  {
    id: 'm1',
    sender_type: 'contact',
    direction: 'inbound',
    body: 'Namaste, NEET repeater fee two parts में pay कर सकते हैं?',
    msg_type: 'text',
    created_at: min(9),
    media: null,
    delivery_status: 'delivered',
    failure_reason: null,
    transcription: null,
  },
  {
    id: 'm2',
    sender_type: 'system',
    direction: 'outbound',
    body: 'Yes — 6 pm and 8 pm batches ഉണ്ട്. ശനി batch-ലും seat available ആണ്.',
    msg_type: 'text',
    created_at: min(8),
    media: null,
    delivery_status: 'delivered',
    failure_reason: null,
    transcription: null,
  },
  {
    id: 'm3',
    sender_type: 'contact',
    direction: 'inbound',
    body: "What's the fee if I pay in two parts?",
    msg_type: 'text',
    created_at: min(7),
    media: null,
    delivery_status: 'delivered',
    failure_reason: null,
    transcription: null,
  },
]

/** One escalate trace after the last customer message → the seam renders
 *  trailing, exactly the §1.3 "handed to you, no reply yet" moment. */
export const MOCK_TRACES: Trace[] = [
  { id: 't1', route: 'llm', matched_rule_key: null, created_at: min(8) },
  { id: 't2', route: 'escalate', matched_rule_key: 'pricing', created_at: min(6) },
]

export const MOCK_FUNNEL = [
  { label: 'New', count: 34 },
  { label: 'Qualified', count: 21 },
  { label: 'Visit', count: 9 },
  { label: 'Won', count: 5 },
]

export const MOCK_HERO = {
  label: 'Open pipeline',
  value: '₹4.2L',
  sub: 'Win rate 38% — 5 won, 8 lost',
}

export const MOCK_TILES = [
  { label: 'Open conversations', value: '18' },
  { label: 'Needs human', value: '3', tone: 'danger' as const, sub: 'waiting for a person' },
  { label: 'Bookings (7 days)', value: '6' },
]

// ACCESS-01 C (AT-27 / AT-28) — mock-only rows for the direction gallery, so
// the Team page and the AI-features card can be reviewed and screenshotted
// without a session. Nothing outside /preview reads these.
export const MOCK_TEAM = [
  { user_id: 'u-1', role: 'client_admin' as const, display_name: 'Joyal Titus', disabled_at: null },
  { user_id: 'u-2', role: 'manager' as const, display_name: 'Bilal Ahmed', disabled_at: null },
  { user_id: 'u-3', role: 'agent' as const, display_name: 'Asha Menon', disabled_at: null },
  { user_id: 'u-4', role: 'agent' as const, display_name: 'Ravi Kumar', disabled_at: null },
  {
    user_id: 'u-5',
    role: 'agent' as const,
    display_name: 'Chen Wei',
    disabled_at: '2026-08-14T09:00:00Z',
  },
]

export const MOCK_FEATURE_GRANTS = [
  {
    id: 'fg-1',
    feature: 'agent_chat',
    granted: true,
    enabled: true,
    enabled_roles: ['agent', 'manager', 'client_admin'],
  },
  { id: 'fg-2', feature: 'insights', granted: true, enabled: true, enabled_roles: ['manager'] },
  {
    id: 'fg-3',
    feature: 'call_transcription',
    granted: true,
    enabled: false,
    enabled_roles: ['manager', 'client_admin'],
  },
  { id: 'fg-4', feature: 'agent_autopilot', granted: false, enabled: true, enabled_roles: [] },
]

// ---------------------------------------------------------------------------
// ACCESS-01 C3 — the manage view, attribution and approvals (sections 20-22).
// Same rule as everything above: /preview is a public route, so nothing here
// may come from (or resemble) a live read.
// ---------------------------------------------------------------------------
export const MOCK_PRODUCTS = [
  {
    id: 'it-1',
    slug: 'weekend-intensive',
    name: 'Weekend intensive',
    category: 'course',
    description: 'Two Saturdays, 9am to 1pm, at the Kochi centre.',
    price: 12000,
    ai_instruction: 'Lead with the schedule; parents ask about timing first.',
    active: true,
  },
  {
    id: 'it-2',
    slug: 'foundation-term',
    name: 'Foundation term',
    category: 'course',
    // Deliberately trips the honesty lint, so the warning is visible in review.
    description: 'Twelve weeks. We guarantee a seat in the next batch.',
    price: 45000,
    ai_instruction: null,
    active: true,
  },
]

export const MOCK_FAQS = [
  {
    id: 'ke-1',
    category: 'fees',
    question: 'Do you offer instalments?',
    keywords: ['instalment', 'emi', 'part payment'],
    answer:
      'Yes — the foundation term can be paid in two instalments, split across the first month.',
    follow_up: 'Would you like the dates for the next batch?',
    active: true,
  },
  {
    id: 'ke-2',
    category: 'logistics',
    question: 'Where are you located?',
    keywords: ['address', 'location', 'directions'],
    answer: 'Panampilly Nagar, Kochi — five minutes from the metro station.',
    follow_up: null,
    active: true,
  },
]

export const MOCK_PROFILE = {
  id: 'bp-1',
  greeting_message: 'Hi! Thanks for writing in. What would you like to know about our courses?',
  fallback_message: 'Let me check that with the team and come back to you.',
  escalation_contact: 'Bilal Ahmed · +91 98470 11111',
  location_text: 'Panampilly Nagar, Kochi',
  payment_text: 'UPI or bank transfer. Instalments available on the foundation term.',
  escalation_keywords: ['human', 'agent', 'manager', 'complaint', 'refund', 'legal', 'cancel'],
  draft: null,
  draft_updated_at: null,
}

export const MOCK_RULES = [
  {
    id: 'pr-1',
    rule_key: 'obj_price_400',
    priority: 400,
    trigger_keywords: ['too costly', 'expensive', 'cheaper'],
    match_mode: 'any',
    response_text:
      'I understand. The foundation term works out to about ₹3,750 a week, and it can be paid in two instalments.',
    media_bundle_key: 'fees_pack',
    active: true,
  },
  {
    id: 'pr-2',
    rule_key: 'tell_timings',
    priority: 210,
    trigger_keywords: ['timing', 'schedule', 'when'],
    match_mode: 'any',
    response_text:
      'Weekday batches run 6pm to 8pm; the weekend intensive is Saturdays, 9am to 1pm.',
    media_bundle_key: null,
    active: true,
  },
]

export const MOCK_CAMPAIGNS = [
  {
    id: 'cm-1',
    campaign_key: 'onam_2026',
    name: 'Onam 2026',
    channel: 'meta_ads',
    context_text: 'Early-bird pricing on the foundation term until 30 September.',
    trigger: { code_keywords: ['onam'], ctwa_source_ids: ['120210000000123'] },
    spend_minor: 4200000,
    active: true,
    starts_at: '2026-08-15T00:00:00Z',
    ends_at: '2026-09-30T00:00:00Z',
  },
]

export const MOCK_ROI = [
  {
    campaign_id: 'cm-1',
    campaign_key: 'onam_2026',
    name: 'Onam 2026',
    channel: 'meta_ads',
    spend_minor: 4200000,
    conversations: 184,
    leads: 96,
    won: 14,
    paid_orders: 14,
    revenue_minor: 63000000,
    cost_per_lead_minor: 43750,
    cost_per_won_minor: 300000,
  },
  {
    campaign_id: 'cm-2',
    campaign_key: 'search_always_on',
    name: 'Search — always on',
    channel: 'google_ads',
    spend_minor: 1800000,
    conversations: 41,
    leads: 0,
    won: 0,
    paid_orders: 0,
    revenue_minor: 0,
    // Zero leads means UNKNOWN cost per lead, never ₹0 — the case worth seeing
    // rendered, since it is the one a reviewer would otherwise read as free.
    cost_per_lead_minor: null,
    cost_per_won_minor: null,
  },
]

export const MOCK_SIGHTINGS = [
  {
    id: 'sg-1',
    source_kind: 'ctwa' as const,
    source_value: '120210000000999',
    hit_count: 7,
    first_seen_at: '2026-08-28T09:12:00Z',
    last_seen_at: '2026-09-02T16:40:00Z',
  },
]

export const MOCK_APPROVAL_GROUPS = [
  {
    sessionId: 'sess-1',
    runId: 'run-1',
    proposerId: 'u-3',
    createdAt: '2026-09-02T11:20:00Z',
    steps: [
      {
        id: 'ev-1',
        sessionId: 'sess-1',
        runId: 'run-1',
        proposerId: 'u-3',
        step: 'step-a',
        tool: 'update_lead',
        argsSummary: { lead: 'Anjali Ramesh', field: 'status', value: 'won' },
        createdAt: '2026-09-02T11:20:00Z',
      },
    ],
  },
]
