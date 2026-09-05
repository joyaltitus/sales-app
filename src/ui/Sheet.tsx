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

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <div
        className="sheet-overlay absolute inset-0 bg-[var(--overlay)]"
        onClick={onClose}
      />
      <div
        className={[
          'sheet-panel absolute bg-surface shadow-elev-2',
          // phone: bottom sheet · desktop (sm+): right side panel
          'inset-x-0 bottom-0 rounded-t-xl border-t border-border',
          'sm:inset-y-0 sm:right-0 sm:left-auto sm:w-[420px] sm:rounded-none sm:rounded-l-xl sm:border-l sm:border-t-0',
        ].join(' ')}
      >
        {title && (
          <div className="flex min-h-14 items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-md font-semibold tracking-[-0.02em] text-fg">{title}</h2>
            <button
              onClick={onClose}
              aria-label="Close"
              className="rounded-md px-2.5 py-1.5 text-xs font-semibold text-fg-subtle hover:bg-surface-sunk hover:text-fg"
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
