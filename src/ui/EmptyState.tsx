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
      {Icon ? (
        <div className="mx-auto mb-3 flex h-8 w-8 items-center justify-center rounded-md border border-dashed border-border-strong text-fg-subtle">
          <Icon aria-hidden size={16} strokeWidth={1.75} />
        </div>
      ) : (
        <div
          aria-hidden
          className="mx-auto mb-3 h-8 w-8 rounded-md border border-dashed border-border-strong"
        />
      )}
      <h3 className="mb-1 text-sm font-semibold text-fg">{title}</h3>
      {body && <p className="text-xs text-fg-muted">{body}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}
