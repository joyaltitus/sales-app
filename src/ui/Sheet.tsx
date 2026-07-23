import { useEffect } from 'react'
import type { ReactNode } from 'react'

type Props = {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}

// Bottom sheet on phone, side panel on desktop. Owned (Radix adoption deferred
// to when a focus-trap-heavy surface needs it). Escape + backdrop close.
export function Sheet({ open, onClose, title, children }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <div
        className="absolute inset-0 bg-[var(--overlay)] transition-opacity"
        onClick={onClose}
      />
      <div
        className={[
          'absolute bg-surface transition-transform',
          // phone: bottom sheet · desktop (sm+): right side panel
          'inset-x-0 bottom-0 rounded-t-md border-t border-border',
          'sm:inset-y-0 sm:right-0 sm:left-auto sm:w-96 sm:rounded-none sm:rounded-l-md sm:border-l sm:border-t-0',
        ].join(' ')}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-fg">{title}</h2>
            <button
              onClick={onClose}
              aria-label="Close"
              className="rounded-sm px-2 py-1 text-xs text-fg-subtle hover:bg-surface-sunk"
            >
              Close
            </button>
          </div>
        )}
        <div className="max-h-[70vh] overflow-y-auto p-4 sm:max-h-none">{children}</div>
      </div>
    </div>
  )
}
