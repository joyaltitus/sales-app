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
    <div className="mx-auto max-w-sm px-4 py-12 text-center" role="alert">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-[color-mix(in_srgb,var(--danger)_20%,var(--border))] bg-danger-subtle text-danger shadow-elev-1">
        <CircleAlert aria-hidden size={21} strokeWidth={1.8} />
      </div>
      <h3 className="mb-1.5 text-md font-semibold tracking-[-0.015em] text-fg">{title}</h3>
      {body && <p className="text-sm leading-relaxed text-fg-muted">{body}</p>}
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
