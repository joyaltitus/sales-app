export type CallOutcomePreview = 'closed' | 'progressing' | 'objection' | 'no_answer' | 'callback'

export type DealBriefPreview = {
  contactId: string
  name: string
  value: number
  stage: string
  lastTouchpoints: { channel: 'whatsapp' | 'email' | 'call'; summary: string; at: string }[]
  openObjection: { key: string; label: string; counter: string } | null
  recommendedGoal: string
  sample: true
}

export type CallLogPreview = {
  id: string
  contactId: string
  direction: 'outbound' | 'inbound'
  startedAt: string
  durationSeconds: number
  outcome: CallOutcomePreview
  objectionKey?: string
  callbackAt?: string
  note?: string
  actor: string
  sample: true
}

export const PREVIEW_DEAL_BRIEF: DealBriefPreview = {
  contactId: 'preview-contact',
  name: 'Anjali Ramesh',
  value: 60000,
  stage: 'Qualified',
  lastTouchpoints: [
    { channel: 'whatsapp', summary: 'Asked whether the fee can be paid in two parts.', at: 'Today · 11:42 am' },
    { channel: 'email', summary: 'Opened the fee breakdown and parent testimonial.', at: 'Yesterday · 6:10 pm' },
    { channel: 'call', summary: 'Mother joined; asked for a day to compare options.', at: '30 Jul · 4:18 pm' },
  ],
  openObjection: { key: 'price', label: 'Price', counter: 'Compare the outcome, not only the fee. Make the two-instalment option concrete.' },
  recommendedGoal: 'Confirm the instalment fit and ask for the ₹5,000 seat reservation.',
  sample: true,
}

export const CALL_LOGS: CallLogPreview[] = [
  { id: 'call-1', contactId: 'preview-contact', direction: 'outbound', startedAt: 'Today · 12:08 pm', durationSeconds: 372, outcome: 'progressing', objectionKey: 'price', note: 'Mother is comfortable with two instalments. Anjali wants the Saturday batch.', actor: 'Asha Thomas', sample: true },
  { id: 'call-2', contactId: 'preview-contact', direction: 'outbound', startedAt: '30 Jul · 4:18 pm', durationSeconds: 148, outcome: 'callback', callbackAt: '31 Jul · 11:00 am', note: 'Asked to call when her father is available.', actor: 'Asha Thomas', sample: true },
]

