import type { LeadDetail, QueueItem, Rebuttal, Snippet } from '../lib/contracts'

export const VIEWER = { user_id: 'user-rep-1', display_name: 'Joyal' }
export const TEAMMATE = { user_id: 'user-rep-9', display_name: 'Meera' }

export const queueItems: QueueItem[] = [
  {
    lead_id: 'lead-101',
    contact_id: 'contact-101',
    person_id: null,
    display_name: 'Anjali Nair',
    phone_e164: '+919845012345',
    channel: 'whatsapp',
    stage_key: 'proposal',
    stage_label: 'Proposal sent',
    status: 'open',
    owner: { ...VIEWER },
    due_at: '2026-08-25T09:30:00.000Z',
    follow_up_id: 'fu-1',
    last_activity_at: '2026-08-24T18:02:00.000Z',
    reason: 'overdue',
  },
  {
    lead_id: 'lead-102',
    contact_id: 'contact-102',
    person_id: null,
    display_name: 'Rahul Menon',
    phone_e164: '+919845067890',
    channel: 'instagram',
    stage_key: 'qualified',
    stage_label: 'Qualified',
    status: 'open',
    owner: null,
    due_at: null,
    follow_up_id: null,
    last_activity_at: '2026-08-25T07:12:00.000Z',
    reason: 'new',
  },
  {
    lead_id: 'lead-103',
    contact_id: 'contact-103',
    person_id: null,
    display_name: 'Fatima Zahra',
    phone_e164: '+919845011122',
    channel: 'phone',
    stage_key: 'negotiation',
    stage_label: 'Negotiating price',
    status: 'open',
    owner: { ...TEAMMATE },
    due_at: '2026-08-25T16:00:00.000Z',
    follow_up_id: 'fu-2',
    last_activity_at: '2026-08-23T11:40:00.000Z',
    reason: 'due',
  },
  {
    lead_id: 'lead-104',
    contact_id: 'contact-104',
    person_id: null,
    display_name: 'Vikram Shetty',
    phone_e164: null,
    channel: 'whatsapp',
    stage_key: 'qualified',
    stage_label: 'Qualified',
    status: 'open',
    owner: { ...VIEWER },
    due_at: null,
    follow_up_id: null,
    last_activity_at: '2026-08-10T09:00:00.000Z',
    reason: 'idle',
  },
]

export const leadDetail: LeadDetail = {
  lead: queueItems[0],
  facts: [
    { id: 'fact-1', kind: 'budget', fact_key: 'budget_max', value: 1500000, status: 'confirmed', confidence: 0.92 },
    { id: 'fact-2', kind: 'timeline', fact_key: 'move_in_month', value: 'October', status: 'suggested', confidence: 0.61 },
    { id: 'fact-3', kind: 'preference', fact_key: 'locality', value: 'Kakkanad', status: 'confirmed', confidence: null },
  ],
  objections: [
    {
      id: 'obj-1',
      taxonomy_key: 'price',
      label: 'Price too high',
      occurred_at: '2026-08-24T17:55:00.000Z',
      note: 'Compared with a cheaper tower nearby.',
      resolved_at: null,
    },
  ],
  timeline: [
    {
      kind: 'message',
      at: '2026-08-24T18:02:00.000Z',
      direction: 'out',
      body: 'Sharing the floor plan and payment schedule now.',
      msg_type: 'text',
      source: 'api',
    },
    {
      kind: 'objection',
      at: '2026-08-24T17:55:00.000Z',
      taxonomy_key: 'price',
      label: 'Price too high',
      source: 'api',
    },
    {
      kind: 'call_log',
      at: '2026-08-24T10:20:00.000Z',
      outcome: 'callback',
      note: 'Asked me to ring after 5 pm.',
      source: 'rep',
    },
    {
      kind: 'note',
      at: '2026-08-23T15:44:00.000Z',
      body: 'Prefers east-facing. Spouse joins the next visit.',
      author: { ...VIEWER },
      source: 'rep',
    },
    {
      kind: 'message',
      at: '2026-08-23T15:30:00.000Z',
      direction: 'in',
      body: 'Is the sample apartment ready for viewing?',
      msg_type: 'text',
      source: 'api',
    },
  ],
  source: 'both',
}

export const emptyLeadDetail: LeadDetail = {
  lead: queueItems[1],
  facts: [],
  objections: [],
  timeline: [],
  source: 'api',
}

export const snippets: Snippet[] = [
  {
    id: 'snip-1',
    title: 'Greeting',
    body: 'Hi {{name}}! Thanks for reaching out about the 3BHK.',
    scope: 'personal',
  },
  {
    id: 'snip-2',
    title: 'Site visit ask',
    body: '{{name}}, would Saturday 10 am work for a site visit?',
    scope: 'personal',
  },
  {
    id: 'snip-3',
    title: 'Payment plan',
    body: 'We have a 10:70:20 plan. {{name}}, I can WhatsApp the sheet.',
    scope: 'shared',
  },
]

export const rebuttals: Rebuttal[] = [
  {
    script_version_id: 'sv-1',
    taxonomy_key: 'price',
    headline: 'Anchor on per-square-foot value, not total price',
    body: 'Compare the loaded rate — club, parking and floor rise are included here.',
    uses: 12,
    won: 5,
  },
  {
    script_version_id: 'sv-1',
    taxonomy_key: 'timing',
    headline: 'Booking now locks the launch price',
    body: 'The current slab ends this month; the next revision is 4% higher.',
    uses: 7,
    won: 4,
  },
  {
    script_version_id: 'sv-2',
    taxonomy_key: 'authority',
    headline: 'Bring both decision-makers to one visit',
    body: 'Offer a weekend slot so spouse and you can see it together.',
    uses: 0,
    won: 0,
  },
]

export const scriptCard = {
  title: 'Discovery call opener',
  versionLabel: 'v3 · current',
  body: 'Confirm the number is right.\n\nAsk what prompted the enquiry TODAY — the answer carries the budget and the urgency.\n\nDo not quote price before hearing it.',
}

export const targetBar = {
  rep_name: 'Joyal',
  month_label: 'August',
  target_value: 1200000,
  achieved_value: 450000,
  incentive_per_won: 2000,
  bonus_at_target: 15000,
}

export const objectionTaxonomy = [
  { key: 'price', label: 'Price too high' },
  { key: 'timing', label: 'Bad timing' },
  { key: 'authority', label: 'Others decide' },
  { key: 'trust', label: 'Never heard of builder' },
]

export const stageOptions = [
  { key: 'new', label: 'New' },
  { key: 'qualified', label: 'Qualified' },
  { key: 'proposal', label: 'Proposal sent' },
  { key: 'negotiation', label: 'Negotiating' },
]
