import type { FollowUpItem } from '../../lib/leads-data'

export type FollowUpDetailPreview = FollowUpItem & {
  sample: true
  person: string
  phone: string
  channel: 'whatsapp' | 'instagram'
  stage: string
  dealValue: number
  conversationId: string
  lastContact: string
  nextAction: string
}

const hoursFromNow = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString()

export const FOLLOW_UP_PREVIEW_ITEMS: FollowUpDetailPreview[] = [
  {
    id: 'followup-preview-anjali',
    lead_id: 'lead-preview-anjali',
    contact_id: 'contact-preview-anjali',
    due_at: hoursFromNow(-2),
    status: 'pending',
    source_call_id: null,
    note: 'Confirm the two-instalment plan and ask for the admission decision.',
    person: 'Anjali Ramesh',
    phone: '+91 98765 42018',
    channel: 'whatsapp',
    stage: 'Proposal shared',
    dealValue: 60000,
    conversationId: 'conversation-preview-anjali',
    lastContact: 'Asked about fee split · 3 hours ago',
    nextAction: 'Call now, confirm ₹30,000 × 2, then ask whether to reserve the seat.',
    sample: true,
  },
  {
    id: 'followup-preview-rahul',
    lead_id: 'lead-preview-rahul',
    contact_id: 'contact-preview-rahul',
    due_at: hoursFromNow(3),
    status: 'pending',
    source_call_id: null,
    note: 'Confirm tomorrow’s campus visit and share the location pin.',
    person: 'Rahul Das',
    phone: '+91 98470 22110',
    channel: 'whatsapp',
    stage: 'Visit planned',
    dealValue: 85000,
    conversationId: 'conversation-preview-rahul',
    lastContact: 'Visit requested · yesterday',
    nextAction: 'Send the location pin and confirm that both parents are attending.',
    sample: true,
  },
  {
    id: 'followup-preview-fathima',
    lead_id: 'lead-preview-fathima',
    contact_id: 'contact-preview-fathima',
    due_at: hoursFromNow(26),
    status: 'snoozed',
    source_call_id: null,
    note: 'Send the admission form after the evening batch schedule.',
    person: 'Fathima Noor',
    phone: '@fathima.noor',
    channel: 'instagram',
    stage: 'Qualified',
    dealValue: 45000,
    conversationId: 'conversation-preview-fathima',
    lastContact: 'Asked for the form · 1 day ago',
    nextAction: 'Send the approved form and ask which evening batch she prefers.',
    sample: true,
  },
]
