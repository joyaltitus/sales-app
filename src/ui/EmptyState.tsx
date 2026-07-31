import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

type Props = {
  title: string
  body?: string
  action?: ReactNode
  /** SA-04: optional lucide icon (§S6 icon ruling — empty states included).
   *  No icon → the original dashed placeholder box, unchanged. */
  icon?: LucideIcon
}

// Empty states teach (§C): "No leads yet — share your WhatsApp link".
export function EmptyState({ title, body, action, icon: Icon }: Props) {
  return (
    <div className="mx-auto max-w-xs py-10 text-center">
      {/* Solid icon tile — the dashed ghost box read as an unfinished
          component, not a designed moment (audit A9). */}
      {Icon && (
        <div className="mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface-sunk text-fg-muted">
          <Icon aria-hidden size={18} strokeWidth={1.75} />
        </div>
      )}
      <h3 className="mb-1 text-sm font-semibold text-fg">{title}</h3>
      {body && <p className="text-xs text-fg-muted">{body}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}
