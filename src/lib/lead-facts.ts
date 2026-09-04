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
  confidence: number
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
