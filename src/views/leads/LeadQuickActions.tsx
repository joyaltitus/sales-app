import { Link } from 'react-router-dom'
import { MessageCircle, Tag } from 'lucide-react'
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
  dealValue: number | null
  conversationId?: string | null
  contactId: string
  captureOpen: boolean
  onCaptureToggle: () => void
}) {
  return <Sheet open={open} onClose={onClose} title={`Actions · ${person}`}>
    <div className="grid grid-cols-2 gap-2">
      <CallButton person={person} phone={phone} dealValue={dealValue} variant="primary" onBegin={onClose} contactId={contactId} conversationId={conversationId} />
      {conversationId ? <Link to={`/inbox?c=${encodeURIComponent(conversationId)}`} className="inline-flex h-12 items-center justify-center gap-1.5 rounded-md border border-border-strong bg-surface text-xs font-semibold text-fg-muted"><MessageCircle aria-hidden size={15} /> Message</Link> : <button className="h-12 rounded-md border border-border text-xs font-semibold text-fg-subtle" disabled>Message</button>}
      <button onClick={onCaptureToggle} className="col-span-2 inline-flex h-12 items-center justify-center gap-1.5 rounded-md border border-border-strong bg-surface text-xs font-semibold text-fg-muted"><Tag aria-hidden size={15} /> Log objection</button>
    </div>
    {captureOpen && <div className="mt-4"><ObjectionCapture contactId={contactId} source="crm" detected={null} /></div>}
  </Sheet>
}
