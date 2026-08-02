export type ObjectionKey =
  | 'price'
  | 'quality'
  | 'competitor'
  | 'timing'
  | 'trust'
  | 'no_budget'
  | 'custom'

export type ScriptStatus = 'draft' | 'testing' | 'standard'

export type ScriptParagraph = {
  before: string
  highlight?: string
  after?: string
}

export type ObjectionScriptPreview = {
  key: ObjectionKey
  label: string
  version: number
  status: ScriptStatus
  headline: string
  paragraphs: ScriptParagraph[]
  winRate: number | null
  uses: number
  wonAfterUse: number | null
  updatedAt: string
  author: string
  sample: true
}

export type ObjectionLogPreview = {
  id: string
  contactId: string
  objectionKey: ObjectionKey
  label: string
  source: 'chat' | 'crm' | 'call'
  note?: string
  actor: string
  occurredAt: string
  resolved: boolean
  sample: true
}

export const OBJECTION_SCRIPTS: ObjectionScriptPreview[] = [
  {
    key: 'price',
    label: 'Price',
    version: 4,
    status: 'standard',
    headline: 'Move from fee to the cost of waiting.',
    paragraphs: [
      { before: 'That makes sense — the fee should feel justified. Let’s ', highlight: 'compare the outcome, not only the fee', after: '.' },
      { before: 'You get the full teaching plan, weekly tests, and a mentor who catches gaps early. The question is whether ', highlight: 'one more attempt without that support costs more', after: ' than starting properly now.' },
      { before: 'Would it help if I showed you the instalment option and exactly what is included?' },
    ],
    winRate: 38,
    uses: 126,
    wonAfterUse: 48,
    updatedAt: '29 Jul 2026',
    author: 'Meera Nair',
    sample: true,
  },
  {
    key: 'quality',
    label: 'Quality',
    version: 2,
    status: 'testing',
    headline: 'Make quality concrete and inspectable.',
    paragraphs: [
      { before: 'You should be careful about quality. Rather than asking you to trust a claim, I can show you ', highlight: 'the weekly plan, faculty access, and recent student progress', after: '.' },
      { before: 'Which matters most to you: teaching depth, individual attention, or test performance?' },
    ],
    winRate: 31,
    uses: 42,
    wonAfterUse: 13,
    updatedAt: '27 Jul 2026',
    author: 'Arun P.',
    sample: true,
  },
  {
    key: 'competitor',
    label: 'Competitor',
    version: 3,
    status: 'standard',
    headline: 'Respect the alternative, then sharpen the choice.',
    paragraphs: [
      { before: 'They’re a credible option. The useful comparison is ', highlight: 'what happens when a student falls behind', after: ' — not just the brochure on day one.' },
      { before: 'Our mentor reviews progress every week and adjusts the plan. May I show you that workflow side by side?' },
    ],
    winRate: 35,
    uses: 84,
    wonAfterUse: 29,
    updatedAt: '26 Jul 2026',
    author: 'Meera Nair',
    sample: true,
  },
  {
    key: 'timing',
    label: 'Timing',
    version: 5,
    status: 'standard',
    headline: 'Turn “later” into a specific decision.',
    paragraphs: [
      { before: 'Of course. When you say later, is the constraint ', highlight: 'the start date, the decision, or the payment timing', after: '?' },
      { before: 'If we solve that one point today, would you be comfortable reserving the seat?' },
    ],
    winRate: 41,
    uses: 109,
    wonAfterUse: 45,
    updatedAt: '31 Jul 2026',
    author: 'Nikhil S.',
    sample: true,
  },
  {
    key: 'trust',
    label: 'Trust',
    version: 2,
    status: 'testing',
    headline: 'Replace reassurance with evidence.',
    paragraphs: [
      { before: 'You don’t need to take my word for it. I can share ', highlight: 'a real class plan, the refund terms, and a parent reference', after: '.' },
      { before: 'Which proof would make the decision feel safe for you?' },
    ],
    winRate: 29,
    uses: 37,
    wonAfterUse: 11,
    updatedAt: '25 Jul 2026',
    author: 'Asha Thomas',
    sample: true,
  },
  {
    key: 'no_budget',
    label: 'No budget',
    version: 1,
    status: 'draft',
    headline: 'Acknowledge the constraint before discussing options.',
    paragraphs: [
      { before: 'I hear you — I don’t want to push past a real budget limit. If the course is otherwise right, we can look at ', highlight: 'a smaller starting commitment or the next suitable intake', after: '.' },
      { before: 'Would either be useful, or should I close the loop for now?' },
    ],
    winRate: null,
    uses: 8,
    wonAfterUse: null,
    updatedAt: '30 Jul 2026',
    author: 'Asha Thomas',
    sample: true,
  },
]

export const OBJECTION_LABELS: { key: ObjectionKey; label: string }[] = [
  { key: 'price', label: 'Price' },
  { key: 'quality', label: 'Quality' },
  { key: 'competitor', label: 'Competitor' },
  { key: 'timing', label: 'Timing' },
  { key: 'trust', label: 'Trust' },
  { key: 'no_budget', label: 'No budget' },
]

export const OBJECTION_HISTORY: ObjectionLogPreview[] = [
  { id: 'oh-1', contactId: 'preview-contact', objectionKey: 'price', label: 'Price', source: 'chat', actor: 'Nikhil S.', occurredAt: 'Today · 11:42 am', resolved: false, sample: true },
  { id: 'oh-2', contactId: 'preview-contact', objectionKey: 'timing', label: 'Timing', source: 'call', note: 'Needs to speak with her father.', actor: 'Asha Thomas', occurredAt: '28 Jul · 4:18 pm', resolved: true, sample: true },
  { id: 'oh-3', contactId: 'preview-contact', objectionKey: 'trust', label: 'Trust', source: 'crm', note: 'Asked for a parent reference.', actor: 'Meera Nair', occurredAt: '24 Jul · 10:06 am', resolved: true, sample: true },
]

