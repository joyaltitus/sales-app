import { createContext, useCallback, useContext, useRef, useState } from 'react'
import type { ReactNode } from 'react'

type Tone = 'neutral' | 'success' | 'danger'
type Toast = { id: number; message: string; tone: Tone }

type ToastApi = { show: (message: string, tone?: Tone) => void }
const ToastContext = createContext<ToastApi>({ show: () => {} })

// Rollback-toast for optimistic writes (§C: optimistic UI everywhere with a
// rollback toast). Owned, no dependency.
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const seq = useRef(0)

  const show = useCallback((message: string, tone: Tone = 'neutral') => {
    const id = ++seq.current
    setToasts((t) => [...t, { id, message, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000)
  }, [])

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={[
              'pointer-events-auto w-full max-w-sm rounded-md border px-4 py-2.5 text-sm',
              t.tone === 'danger'
                ? 'border-danger bg-danger-subtle text-danger'
                : t.tone === 'success'
                  ? 'border-border bg-surface text-success'
                  : 'border-border bg-surface text-fg',
            ].join(' ')}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
