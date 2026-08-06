import { Link } from 'react-router-dom'
import { ListTodo, Mail, MessageCircle, Sparkles, Tag } from 'lucide-react'
import { Sheet } from '../../ui/Sheet'
import { CallButton } from '../calls/CallButton'
import { ObjectionCapture } from '../objections/ObjectionCapture'

export function LeadQuickActions({
  open,
  onClose,
  person,
  phone,
  dealValue,
  conversationId,
  contactId,
  captureOpen,
  onCaptureToggle,
}: {
  open: boolean
  onClose: () => void
  person: string
  phone?: string | null
  dealValue: number
  conversationId?: string | null
  contactId: string
  captureOpen: boolean
  onCaptureToggle: () => void
}) {
  return <Sheet open={open} onClose={onClose} title={`Actions · ${person}`}>
    <p className="text-2xs text-fg-muted">Same actions everywhere · Preview — not wired</p>
    <div className="mt-3 grid grid-cols-2 gap-2">
      <CallButton person={person} phone={phone} dealValue={dealValue} variant="primary" onBegin={onClose} contactId={contactId} conversationId={conversationId} />
      {conversationId ? <Link to={`/inbox?c=${encodeURIComponent(conversationId)}`} className="inline-flex h-12 items-center justify-center gap-1.5 rounded-md border border-border-strong bg-surface text-xs font-semibold text-fg-muted"><MessageCircle aria-hidden size={15} /> Message</Link> : <button className="h-12 rounded-md border border-border text-xs font-semibold text-fg-subtle" disabled>Message</button>}
      <button className="inline-flex h-12 items-center justify-center gap-1.5 rounded-md border border-border-strong bg-surface text-xs font-semibold text-fg-muted"><Mail aria-hidden size={15} /> Email</button>
      <CallButton person={person} phone={phone} dealValue={dealValue} label="Brief me" onBegin={onClose} contactId={contactId} conversationId={conversationId} />
      <button onClick={onCaptureToggle} className="inline-flex h-12 items-center justify-center gap-1.5 rounded-md border border-border-strong bg-surface text-xs font-semibold text-fg-muted"><Tag aria-hidden size={15} /> Log objection</button>
      <button className="inline-flex h-12 items-center justify-center gap-1.5 rounded-md border border-border-strong bg-surface text-xs font-semibold text-fg-muted"><ListTodo aria-hidden size={15} /> Assign todo</button>
    </div>
    {captureOpen && <div className="mt-4"><ObjectionCapture contactId={contactId} source="crm" detected={null} /></div>}
    <div className="mt-4 flex items-center gap-2 rounded-lg bg-accent-subtle p-3 text-xs text-accent"><Sparkles aria-hidden size={14} /><span><strong>Copilot:</strong> Call before 4 pm; price is the only open objection.</span></div>
  </Sheet>
}
