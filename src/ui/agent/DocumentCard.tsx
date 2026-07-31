import { FileText } from 'lucide-react'
import { StatusBadge } from './primitives'
import type { MockDoc, DocStatus } from '../../lib/mock-wave3'

const STATUS_TONE: Record<DocStatus, 'neutral' | 'accent' | 'success'> = {
  draft: 'neutral',
  final: 'accent',
  sent: 'success',
}

const STATUS_LABEL: Record<DocStatus, string> = {
  draft: 'Draft',
  final: 'Final',
  sent: 'Sent',
}

export function DocumentCard({ doc, onOpen }: { doc: MockDoc; onOpen?: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-md border border-border bg-surface p-3 text-left shadow-elev-1 transition-[border-color,box-shadow] hover:border-border-strong hover:shadow-elev-2"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-surface-sunk text-fg-muted">
        <FileText aria-hidden size={16} strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-fg">{doc.template}</span>
        <span className="mt-0.5 block truncate text-2xs text-fg-subtle">
          {doc.customer} · {doc.amount} ·{' '}
          <span className="tnum">v{doc.version}</span>
        </span>
      </span>
      <StatusBadge tone={STATUS_TONE[doc.status]}>{STATUS_LABEL[doc.status]}</StatusBadge>
    </button>
  )
}
