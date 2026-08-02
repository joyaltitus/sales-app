export type CopilotToolKind = 'send_email' | 'send_whatsapp' | 'schedule_follow_up' | 'create_booking' | 'draft_quotation' | 'update_stage' | 'add_note' | 'assign_todo'
export type CopilotToolState = 'proposed' | 'executing' | 'done' | 'failed'

export type CopilotToolActionPreview = {
  id: string
  kind: CopilotToolKind
  title: string
  summary: string
  target: string
  preview?: string
  state: CopilotToolState
  reversible: boolean
  sample: true
}

export type RecognizedCommandPreview = {
  raw: string
  intent: CopilotToolKind
  entity: { type: 'lead' | 'conversation' | 'contact'; id: string; label: string }
  parameters: Record<string, string>
  requiresApproval: boolean
  sample: true
}

export const COPILOT_ACTIONS: CopilotToolActionPreview[] = [
  { id: 'cp-1', kind: 'send_email', title: 'Send annual commercial', summary: 'Email Kavya the revised annual option and confirm 19 August.', target: 'Kavya Menon · Mumbai Clinic', preview: 'Hi Kavya, I’ve attached the annual commercial and confirmed the 19 August onboarding slot…', state: 'proposed', reversible: false, sample: true },
  { id: 'cp-2', kind: 'send_whatsapp', title: 'Send Price counter-script', summary: 'Insert the company standard as an editable reply to Anjali.', target: 'Anjali Ramesh · WhatsApp', preview: 'That makes sense — the fee should feel justified. Let’s compare the outcome, not only the fee…', state: 'proposed', reversible: false, sample: true },
  { id: 'cp-3', kind: 'schedule_follow_up', title: 'Schedule callback', summary: 'Create a 4:00 pm callback and place it on Today.', target: 'Rahul Das', state: 'proposed', reversible: true, sample: true },
  { id: 'cp-4', kind: 'create_booking', title: 'Hold onboarding slot', summary: 'Hold 19 August at 10:00 am for thirty minutes.', target: 'Mumbai Clinic · Priya', state: 'proposed', reversible: true, sample: true },
  { id: 'cp-5', kind: 'draft_quotation', title: 'Draft annual quotation', summary: 'Use the approved annual plan and locked commercial terms.', target: 'Mumbai Clinic · ₹2.4L', state: 'proposed', reversible: true, sample: true },
  { id: 'cp-6', kind: 'update_stage', title: 'Move to Commercial review', summary: 'The buyer requested a revised commercial and start date.', target: 'Mumbai Clinic', state: 'proposed', reversible: true, sample: true },
  { id: 'cp-7', kind: 'add_note', title: 'Add decision-maker fact', summary: 'Kavya owns approval; Dr Shah signs the annual agreement.', target: 'Mumbai Clinic · CRM', state: 'done', reversible: true, sample: true },
  { id: 'cp-8', kind: 'assign_todo', title: 'Assign legal follow-up', summary: 'Ask Nikhil to confirm the data-processing addendum by tomorrow.', target: 'Nikhil S.', state: 'failed', reversible: true, sample: true },
]

