import { createContext, useCallback, useContext, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Check, CircleAlert, Info, X } from 'lucide-react'

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
      <div className="fixed inset-x-0 bottom-5 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={[
              'pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-lg border px-3 py-3 text-sm shadow-elev-3 backdrop-blur-xl',
              t.tone === 'danger'
                ? 'border-[color-mix(in_srgb,var(--danger)_30%,var(--border))] bg-danger-subtle text-danger'
                : t.tone === 'success'
                  ? 'border-[color-mix(in_srgb,var(--success)_24%,var(--border))] bg-surface-glass text-success'
                  : 'border-border bg-surface-glass text-fg',
            ].join(' ')}
          >
            {t.tone === 'danger' ? <CircleAlert aria-hidden size={17} /> : t.tone === 'success' ? <Check aria-hidden size={17} /> : <Info aria-hidden size={17} />}
            <span className="min-w-0 flex-1">{t.message}</span>
            <button
              onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))}
              className="rounded-sm p-1 text-current opacity-60 hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/5"
              aria-label="Dismiss notification"
            >
              <X aria-hidden size={15} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
