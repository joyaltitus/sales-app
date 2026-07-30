import type { ReactNode } from 'react'
import { CircleAlert } from 'lucide-react'
import { Button } from './Button'

type Props = {
  /** Honest words: what happened, in the interface's voice. No apology. */
  title: string
  body?: string
  /** Retry is the default next action; omit when there is nothing to retry. */
  onRetry?: () => void
  action?: ReactNode
}

// Designed error moment (audit A13) — the counterpart of EmptyState. Errors
// say what happened and what to do: "Couldn't load the queue. Retry."
export function ErrorState({ title, body, onRetry, action }: Props) {
  return (
    <div className="mx-auto max-w-xs py-10 text-center" role="alert">
      <div className="mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-md border border-border bg-danger-subtle text-danger">
        <CircleAlert aria-hidden size={18} strokeWidth={1.75} />
      </div>
      <h3 className="mb-1 text-sm font-semibold text-fg">{title}</h3>
      {body && <p className="text-xs text-fg-muted">{body}</p>}
      {(onRetry || action) && (
        <div className="mt-4 flex justify-center gap-2">
          {onRetry && (
            <Button variant="secondary" size="sm" onClick={onRetry}>
              Retry
            </Button>
          )}
          {action}
        </div>
      )}
    </div>
  )
}
