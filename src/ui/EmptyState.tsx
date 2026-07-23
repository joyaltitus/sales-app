import type { ReactNode } from 'react'

type Props = {
  title: string
  body?: string
  action?: ReactNode
}

// Empty states teach (§C): "No leads yet — share your WhatsApp link".
export function EmptyState({ title, body, action }: Props) {
  return (
    <div className="mx-auto max-w-xs py-10 text-center">
      <div
        aria-hidden
        className="mx-auto mb-3 h-8 w-8 rounded-md border border-dashed border-border-strong"
      />
      <h3 className="mb-1 text-sm font-semibold text-fg">{title}</h3>
      {body && <p className="text-xs text-fg-muted">{body}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}
