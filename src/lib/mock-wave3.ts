// UI-BUILD-02 — ALL Wave-3 surface mock data lives HERE (SA-04 pattern: one
// module, wiring later = hook-body swap; components never know it's mock).
// Realistic education-vertical fiction (SEED-01's demo world). NO live reads.

// ---------------------------------------------------------------- fact model
export type FactState = 'suggested' | 'confirmed' | 'corrected' | 'retired'
export type FactCategory =
  | 'requirement'
  | 'budget'
  | 'preference'
  | 'objection'
  | 'buying_signal'
  | 'promise'
  | 'follow_up'
  | 'interest'

export type LeadFact = {
  id: string
  category: FactCategory
  label: string
  value: string
  state: FactState
  confidence: number // 0..1
  evidence: { quote: string; channel: 'whatsapp' | 'instagram'; at: string }
  history?: { from: string; to: string; by: string; at: string }[]
}

export const FACT_CATEGORY_LABEL: Record<FactCategory, string> = {
  requirement: 'Requirement',
  budget: 'Budget',
  preference: 'Preference',
  objection: 'Objection',
  buying_signal: 'Buying signal',
  promise: 'Promise',
  follow_up: 'Follow-up',
  interest: 'Interest',
}

const h = (n: number) => new Date(Date.now() - n * 3600_000).toISOString()

export const MOCK_FACTS: LeadFact[] = [
  {
    id: 'f1',
    category: 'requirement',
    label: 'Course',
    value: 'NEET repeater batch, evening only',
    state: 'confirmed',
    confidence: 0.96,
    evidence: { quote: 'Do you have evening batches for NEET repeaters?', channel: 'whatsapp', at: h(26) },
  },
  {
    id: 'f2',
    category: 'budget',
    label: 'Budget',
    value: '₹60,000 total, needs two instalments',
    state: 'suggested',
    confidence: 0.78,
    evidence: { quote: "What's the fee if I pay in two parts?", channel: 'whatsapp', at: h(3) },
  },
  {
    id: 'f3',
    category: 'promise',
    label: 'Promised',
    value: 'Will confirm after talking to father',
    state: 'confirmed',
    confidence: 0.91,
    evidence: { quote: 'I will ask my father tonight and tell you', channel: 'whatsapp', at: h(20) },
  },
  {
    id: 'f4',
    category: 'objection',
    label: 'Objection',
    value: 'Travel distance from Aluva is a concern',
    state: 'corrected',
    confidence: 0.88,
    evidence: { quote: 'Aluva se daily aana difficult hoga', channel: 'whatsapp', at: h(44) },
    history: [{ from: 'Lives in Kochi', to: 'Lives in Aluva, travel concern', by: 'Anil', at: h(41) }],
  },
  {
    id: 'f5',
    category: 'buying_signal',
    label: 'Signal',
    value: 'Asked for admission form twice',
    state: 'suggested',
    confidence: 0.83,
    evidence: { quote: 'Can you send the admission form?', channel: 'instagram', at: h(2) },
  },
  {
    id: 'f6',
    category: 'follow_up',
    label: 'Follow up',
    value: 'Tomorrow 6pm — instalment decision',
    state: 'confirmed',
    confidence: 0.94,
    evidence: { quote: 'call me tomorrow evening after 6', channel: 'whatsapp', at: h(3) },
  },
]

// ---------------------------------------------------------- next-best actions
export type ActionUrgency = 'now' | 'today' | 'this_week'
export type NbaKind =
  | 'reply_due'
  | 'neglected'
  | 'follow_up_risk'
  | 'buying_signal'
  | 'deal_risk'
  | 'revive'
  | 'meeting'

export type NextAction = {
  id: string
  kind: NbaKind
  customer: string
  conversationId: string
  action: string
  why: string
  urgency: ActionUrgency
  due?: string
  brainContext?: string
  evidence?: string
  suggestedReply?: string
}

export const MOCK_ACTIONS: NextAction[] = [
  {
    id: 'a1',
    kind: 'reply_due',
    customer: 'Anjali Ramesh',
    conversationId: 'c1',
    action: 'Answer the instalment question',
    why: 'Waiting 42 min on a pricing question the bot handed over',
    urgency: 'now',
    brainContext: 'Budget ₹60,000 · needs two instalments',
    evidence: '"What\'s the fee if I pay in two parts?"',
    suggestedReply:
      'Yes Anjali — the NEET repeater fee can be split into two instalments of ₹30,000. The first covers admission and materials.',
  },
  {
    id: 'a2',
    kind: 'buying_signal',
    customer: 'Fathima Noor',
    conversationId: 'c3',
    action: 'Send the admission form',
    why: 'Asked for the form twice in 2 days — strong intent',
    urgency: 'today',
    brainContext: 'Signal: asked for admission form twice',
    evidence: '"Can you send the admission form?"',
  },
  {
    id: 'a3',
    kind: 'follow_up_risk',
    customer: 'Vishnu K',
    conversationId: 'c2',
    action: 'Call before 6pm as promised',
    why: 'Promised call is due in 3 hours; missing it loses trust',
    urgency: 'today',
    due: '6:00 pm',
    brainContext: 'Promise: will confirm after talking to father',
  },
  {
    id: 'a4',
    kind: 'neglected',
    customer: 'Divya Menon',
    conversationId: 'c4',
    action: 'Re-open the Plus-2 tuition thread',
    why: 'No touch in 6 days after a fee quote — going cold',
    urgency: 'this_week',
    suggestedReply:
      'Hi Divya — the Plus-2 evening batch you asked about starts Monday. Two seats left; shall I hold one?',
  },
  {
    id: 'a5',
    kind: 'meeting',
    customer: 'Rahul Das',
    conversationId: 'c5',
    action: 'Prepare for tomorrow’s campus visit',
    why: 'Site visit 10:30 am — brief is ready',
    urgency: 'this_week',
    due: 'Tomorrow 10:30 am',
  },
]

// ------------------------------------------------------------------ approvals
export type ApprovalTier = 'auto' | 'one_tap' | 'explicit'

export type ProposedAction = {
  id: string
  tier: ApprovalTier
  title: string
  target: string // customer / deal affected
  what: string
  before?: string
  after?: string
  why: string
}

export const MOCK_PROPOSALS: ProposedAction[] = [
  {
    id: 'p1',
    tier: 'one_tap',
    title: 'Update lead stage',
    target: 'Anjali Ramesh · NEET repeater',
    what: 'Move stage Qualified → Visit planned',
    before: 'Qualified',
    after: 'Visit planned',
    why: 'She agreed to visit the campus on Saturday',
  },
  {
    id: 'p2',
    tier: 'explicit',
    title: 'Send quotation',
    target: 'Anjali Ramesh · NEET repeater',
    what: 'Send "NEET Repeater — 2-instalment plan" PDF in WhatsApp',
    why: 'Instalment split was the last open question',
  },
  {
    id: 'p3',
    tier: 'one_tap',
    title: 'Create follow-up',
    target: 'Vishnu K · Plus-2',
    what: 'Follow-up tomorrow 6:00 pm — instalment decision',
    why: 'He asked to be called after talking to his father',
  },
]

// ---------------------------------------------------------------- agent script
export type AgentMsg =
  | { id: string; role: 'user' | 'agent'; text: string }
  | { id: string; role: 'tool'; tool: string; status: 'running' | 'done'; summary: string }
  | { id: string; role: 'proposal'; proposal: ProposedAction }

export const AGENT_STARTERS = [
  'Summarise this customer',
  'Draft a reply about instalments',
  'Which leads should I revive today?',
  'Prepare a quotation for Anjali',
]

export const MOCK_AGENT_THREAD: AgentMsg[] = [
  { id: 'g1', role: 'user', text: 'Prepare a quotation for Anjali with the 2-instalment plan' },
  { id: 'g2', role: 'tool', tool: 'Lead Brain', status: 'done', summary: 'Budget ₹60,000 · two instalments · NEET repeater evening' },
  { id: 'g3', role: 'tool', tool: 'Templates', status: 'done', summary: 'Matched "Fee quotation — instalment plan"' },
  {
    id: 'g4',
    role: 'agent',
    text: 'Draft ready: NEET Repeater evening batch, ₹60,000 in two instalments of ₹30,000 (admission + materials in the first). Preview below — sending needs your approval.',
  },
  { id: 'g5', role: 'proposal', proposal: MOCK_PROPOSALS[1] },
]

export const MOCK_AGENT_ACTIVITY = [
  { id: 'h1', at: h(1), text: 'Created follow-up for Vishnu K (approved by you)' },
  { id: 'h2', at: h(4), text: 'Drafted instalment reply for Anjali (edited, then sent)' },
  { id: 'h3', at: h(28), text: 'Matched 3 neglected leads to the new evening batch' },
]

// ------------------------------------------------------------------ documents
export type DocStatus = 'draft' | 'final' | 'sent'
export type MockDoc = {
  id: string
  template: string
  customer: string
  amount: string
  status: DocStatus
  version: number
  at: string
}

export const DOC_TEMPLATES = [
  'Fee quotation — instalment plan',
  'Course proposal',
  'Batch comparison',
  'Payment plan',
  'Meeting summary',
  'Requirement summary',
]

export const MOCK_DOCS: MockDoc[] = [
  { id: 'd1', template: 'Fee quotation — instalment plan', customer: 'Anjali Ramesh', amount: '₹60,000', status: 'draft', version: 2, at: h(1) },
  { id: 'd2', template: 'Batch comparison', customer: 'Rahul Das', amount: '—', status: 'sent', version: 1, at: h(22) },
  { id: 'd3', template: 'Course proposal', customer: 'Divya Menon', amount: '₹45,000', status: 'final', version: 3, at: h(50) },
]

// ------------------------------------------------------------------- matching
export type MatchItem = {
  id: string
  name: string
  detail: string
  fit: string[]
  price: string
}

export const MOCK_MATCHES: MatchItem[] = [
  {
    id: 'm1',
    name: 'NEET Repeater — Evening',
    detail: '6pm–9pm · Mon–Sat · starts Aug 11',
    fit: ['Evening only ✓', 'Within ₹60,000 ✓', 'Instalments available ✓'],
    price: '₹60,000',
  },
  {
    id: 'm2',
    name: 'NEET Repeater — Weekend intensive',
    detail: 'Sat–Sun full day · starts Aug 16',
    fit: ['Solves Aluva travel objection ✓', 'Within budget ✓'],
    price: '₹52,000',
  },
]

export const MOCK_REVIVE = [
  { id: 'r1', customer: 'Sreelakshmi P', reason: 'Asked about evening batch in May — one just opened', last: '9 weeks ago' },
  { id: 'r2', customer: 'Arjun Nair', reason: 'Lost on price — new instalment plan fits his stated budget', last: '5 weeks ago' },
]

// -------------------------------------------------------------------- booking
export const MOCK_SLOTS = [
  { id: 's1', label: 'Tomorrow 10:30 am', who: 'Anil (counsellor)', free: true },
  { id: 's2', label: 'Tomorrow 4:00 pm', who: 'Meera (counsellor)', free: true },
  { id: 's3', label: 'Saturday 11:00 am', who: 'Anil (counsellor)', free: false },
]

// -------------------------------------------------------- manager intelligence
export const MOCK_MANAGER = {
  pipelineHealth: [
    { stage: 'New', count: 34, risk: 3 },
    { stage: 'Qualified', count: 21, risk: 5 },
    { stage: 'Visit', count: 9, risk: 1 },
    { stage: 'Won', count: 5, risk: 0 },
  ],
  forecast: { month: '₹6.8L', confident: '₹4.1L' },
  atRisk: [
    { customer: 'Divya Menon', value: '₹45,000', why: 'No touch in 6 days after quote' },
    { customer: 'Arjun Nair', value: '₹52,000', why: 'Objection unanswered for 3 days' },
  ],
  followUpCompletion: 0.82,
  medianResponseMin: 11,
  rescued: 4,
  coaching: [
    { who: 'Anil', note: 'Great at first response (4 min median) — share his opener with the team' },
    { who: 'Meera', note: 'Instalment objections often stall — pair with Anil on the next two pricing calls' },
  ],
  winning: 'Threads answered within 15 min convert 2.4× more often to visits.',
  lostReasons: [
    { reason: 'Price / instalments', count: 6 },
    { reason: 'Travel distance', count: 4 },
    { reason: 'Chose competitor', count: 3 },
  ],
}

// ------------------------------------------------------------- rep motivation
export const MOCK_PROGRESS = {
  repliesToday: 14,
  followUpsDone: 5,
  followUpsPlanned: 7,
  streakDays: 4,
  responseTrend: 'Median reply 9 min — 3 min faster than last week',
  teamGoal: { label: 'Team visits this week', done: 11, target: 15 },
  recognition: 'Your Tuesday save (Fathima) became a campus visit.',
}
