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
