import type {
  CourseItem, LeadDetail, PersonalSpin, PlaybookLibrary, QueueItem, Rebuttal, SalesConfig, ScriptBody, Snippet,
} from '../lib/contracts'

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

// ── Playbook ─────────────────────────────────────────────────────────────────

/** The longest Manglish paragraph in the seed. The 380px overflow test measures
 *  against THIS: an unbroken 60-character word is what actually breaks a
 *  narrow column, and Manglish transliterations produce them. */
export const LONGEST_MN =
  'Ithu oru complete full-stack development bootcamp aanu — HTML, CSS, JavaScript, React, Node, PostgreSQL ellaam undu, ' +
  'pinne placement-support um. Fee {{course.fee}} aanu, EMI {{course.emi}} × {{course.emi_months}} months. ' +
  'Batch {{course.batch_start}} thudangum, seat block cheyyaan {{pay.amount}} maathram mathi. ' +
  'Njangalude previous batch-il {{course.proof}}. Link ithaanu: {{pay.url}}'

function script(over: Partial<Rebuttal> & Pick<Rebuttal, 'taxonomy_key' | 'label'>): Rebuttal {
  return {
    taxonomy_id: `tax-${over.taxonomy_key}`,
    kind: 'objection',
    position: 0,
    icon: null,
    status: 'active',
    script_id: `sc-${over.taxonomy_key}`,
    script_version_id: `sv-${over.taxonomy_key}`,
    version: 3,
    created_at: '2026-08-01T00:00:00.000Z',
    headline: null,
    body: null,
    langs: ['en'],
    uses: 0,
    rated: 0,
    won: 0,
    spin: null,
    ...over,
  }
}

const body = (en: string, mn?: string): ScriptBody => ({
  lang: 'en',
  paragraphs: [{ before: en }],
  ...(mn ? { variants: { mn: { paragraphs: [{ before: mn }] } } } : {}),
})

export const roadmapScripts: Rebuttal[] = [
  script({
    taxonomy_key: 'stage_hook_cold', label: 'Opener — cold', kind: 'stage', position: 10, icon: 'phone',
    body: body('Hi {{name}}, {{rep}} here from {{client.name}}. Two minutes?'),
  }),
  script({
    taxonomy_key: 'stage_hook_inbound', label: 'Opener — inbound', kind: 'stage', position: 11, icon: 'message-circle',
    body: body('Hi {{name}}, {{rep}} from {{client.name}} — you asked about {{course.name}}.'),
  }),
  script({
    taxonomy_key: 'stage_hook_followup', label: 'Opener — follow-up', kind: 'stage', position: 12, icon: 'clock',
    body: body('Hi {{name}}, {{rep}} again — picking up where we left off.'),
  }),
  script({
    taxonomy_key: 'stage_discover', label: 'Find the why', kind: 'stage', position: 20, icon: 'help-circle',
    langs: ['en', 'mn'],
    body: {
      lang: 'en',
      paragraphs: [{ before: 'What made you look at this ', highlight: 'now', after: ' rather than last year?' }],
      variants: { mn: { paragraphs: [{ before: 'Ippo entha ithu nokkaan thonniyathu?' }] } },
    },
  }),
  script({
    taxonomy_key: 'stage_pitch', label: 'The offer', kind: 'stage', position: 30, icon: 'graduation-cap',
    langs: ['en', 'mn'],
    uses: 22, rated: 18, won: 11,
    body: {
      lang: 'en',
      paragraphs: [
        { before: '{{course.name}} runs {{course.duration}}, fee {{course.fee}}. ', highlight: 'EMI is {{course.emi}} a month.', after: '' },
        { before: '{{course.usp}} — {{course.proof}}.' },
      ],
      variants: { mn: { paragraphs: [{ before: LONGEST_MN }] } },
    },
  }),
  script({
    taxonomy_key: 'stage_close', label: 'Ask for the seat', kind: 'stage', position: 40, icon: 'badge-check',
    uses: 14, rated: 12, won: 7,
    body: body('Shall I block a seat for you with {{pay.amount}}?'),
  }),
]

export const composedScripts: Rebuttal[] = [
  script({
    taxonomy_key: 'token_request', label: 'Seat token text', kind: 'stage', position: 90, icon: 'credit-card',
    langs: ['en', 'mn'],
    body: {
      lang: 'en',
      paragraphs: [{
        before: '{{name}}, to block your seat in {{course.name}}: pay {{pay.amount}} here — {{pay.url}}\nUPI: {{pay.upi}}',
      }],
      variants: { mn: { paragraphs: [{ before: '{{name}}, seat block cheyyaan {{pay.amount}} — {{pay.url}} · UPI {{pay.upi}}' }] } },
    },
  }),
  script({
    taxonomy_key: 'callback_confirm', label: 'Callback confirmation', kind: 'stage', position: 91, icon: 'calendar',
    body: body('Locked it in, {{name}} — I will call you {{callback.when}}.'),
  }),
]

export const rebuttals: Rebuttal[] = [
  script({
    taxonomy_key: 'price', label: 'Too expensive', position: 1, icon: 'wallet',
    headline: 'Anchor on per-square-foot value, not total price',
    langs: ['en', 'mn'],
    uses: 12, rated: 12, won: 5,
    body: {
      lang: 'en',
      paragraphs: [{ before: 'Compare the loaded rate — club, parking and floor rise are included here.' }],
      variants: { mn: { paragraphs: [{ before: 'Loaded rate നോക്കൂ — club, parking ellaam ullathaanu.' }] } },
    },
  }),
  script({
    taxonomy_key: 'timing', label: 'Wrong time', position: 2, icon: 'clock',
    headline: 'Booking now locks the launch price',
    uses: 7, rated: 7, won: 4,
    body: body('The current slab ends this month; the next revision is 4% higher.'),
  }),
  script({
    taxonomy_key: 'authority', label: 'Others decide', position: 3, icon: 'users',
    headline: 'Bring both decision-makers to one visit',
    script_version_id: 'sv-authority',
    body: body('Offer a weekend slot so spouse and you can see it together.'),
  }),
  script({
    taxonomy_key: 'trust', label: 'Never heard of you', position: 4, icon: 'shield-alert',
    uses: 3, rated: 3, won: 1,
    body: body('{{course.proof}} — happy to put you on a call with one of them.'),
  }),
]

export const courses: CourseItem[] = [
  {
    id: 'item-0003', name: 'Full Stack Bootcamp', category: 'course', active: true,
    sales_facts: {
      fee: 85000, emi_monthly: 7100, emi_months: 12, duration: '6 months', batch_start: '2026-10-15',
      usp: 'Placement support until you land the job', proof: '312 alumni placed last year', token_amount: 5000,
    },
  },
  {
    id: 'item-0004', name: 'Data Analytics Sprint', category: 'course', active: true,
    sales_facts: { fee: 42000, duration: '10 weeks', batch_start: '2026-09-29' },
  },
  { id: 'item-0009', name: 'Retired Evening Batch', category: 'course', active: false, sales_facts: null },
]

export const salesConfig: SalesConfig = {
  languages: ['en', 'mn'],
  default_lang: 'en',
  upi_vpa: 'bright@okhdfcbank',
  upi_payee: 'Bright Academy',
  pay_url: 'https://pay.brightacademy.in/seat',
  token_amount: 2000,
  token_note: 'Seat token',
}

export const spins: PersonalSpin[] = [
  {
    id: 'spin-1', script_id: 'sc-stage_pitch', lang: 'en', title: 'The offer',
    body: 'Look — {{course.fee}} all in, or {{course.emi}} a month. I did this course myself.',
    updated_at: '2026-08-20T00:00:00.000Z',
  },
]

export const playbookLibrary: PlaybookLibrary = {
  scripts: [...roadmapScripts, ...rebuttals, ...composedScripts],
  courses,
  config: salesConfig,
  spins,
}

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
