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
    <div className="mx-auto max-w-sm px-4 py-12 text-center">
      {/* Solid icon tile — the dashed ghost box read as an unfinished
          component, not a designed moment (audit A9). */}
      {Icon && (
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-[linear-gradient(145deg,var(--surface-raised),var(--surface-sunk))] text-accent shadow-elev-1">
          <Icon aria-hidden size={21} strokeWidth={1.8} />
        </div>
      )}
      <h3 className="mb-1.5 text-md font-semibold tracking-[-0.015em] text-fg">{title}</h3>
      {body && <p className="text-sm leading-relaxed text-fg-muted">{body}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}
