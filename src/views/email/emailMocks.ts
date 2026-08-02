export type EmailAttachmentPreview = { id: string; name: string; mime: string; size: string; sample: true }

export type EmailMessagePreview = {
  id: string
  from: { name: string; address: string }
  to: { name: string; address: string }[]
  sentAt: string
  body: string[]
  quotedBody?: string
  attachments: EmailAttachmentPreview[]
  sample: true
}

export type EmailThreadPreview = {
  id: string
  contactId: string
  contactName: string
  contactEmail: string
  subject: string
  unread: boolean
  lastActivityAt: string
  messages: EmailMessagePreview[]
  dealValue: number
  sample: true
}

export type GmailConnectionPreview = {
  account: string | null
  status: 'disconnected' | 'connecting' | 'connected' | 'error'
  scopes: ('read' | 'send')[]
  lastSyncAt: string | null
  error?: string
  sample: true
}

export const EMAIL_THREAD: EmailThreadPreview = {
  id: 'email-thread-1', contactId: 'contact-kavya', contactName: 'Kavya Menon', contactEmail: 'kavya@northstarclinic.in', subject: 'Corporate wellness proposal — Mumbai Clinic', unread: true, lastActivityAt: '12m', dealValue: 240000, sample: true,
  messages: [
    { id: 'em-1', from: { name: 'Kavya Menon', address: 'kavya@northstarclinic.in' }, to: [{ name: 'Priya', address: 'priya@acme.in' }], sentAt: 'Today · 11:08 am', body: ['Hi Priya,', 'The clinical team liked the pilot outline. Could you send a revised commercial with the annual option and confirm whether onboarding can start on 19 August?', 'Regards,\nKavya'], quotedBody: 'On Fri, Priya wrote: Sharing the pilot scope and outcomes from the discovery call…', attachments: [{ id: 'att-1', name: 'Clinic-requirements.xlsx', mime: 'application/xlsx', size: '92 KB', sample: true }], sample: true },
    { id: 'em-2', from: { name: 'Priya', address: 'priya@acme.in' }, to: [{ name: 'Kavya Menon', address: 'kavya@northstarclinic.in' }], sentAt: 'Yesterday · 4:42 pm', body: ['Hi Kavya,', 'Attached is the pilot scope with the three outcomes we agreed on. I’ll hold the 19 August onboarding slot while you review.', 'Best,\nPriya'], attachments: [{ id: 'att-2', name: 'Pilot-scope.pdf', mime: 'application/pdf', size: '318 KB', sample: true }], sample: true },
  ],
}

export const EMAIL_TEMPLATES = [
  { id: 'et-1', label: 'Proposal follow-up', subject: 'Re: Corporate wellness proposal', body: 'Hi Kavya,\n\nI’ve attached the annual commercial and confirmed the 19 August onboarding slot. The annual plan protects the pricing for twelve months.\n\nWould you like me to send the approval link today?\n\nBest,\nPriya', sample: true as const },
  { id: 'et-2', label: 'Meeting recap', subject: 'Today’s recap and next step', body: 'Hi Kavya,\n\nHere are the decisions and the one open item from today.\n\nBest,\nPriya', sample: true as const },
]

