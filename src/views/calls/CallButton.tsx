import { lazy, Suspense, useEffect, useState } from 'react'
import { Check, Phone } from 'lucide-react'
import type { CallOutcomePreview } from './callMocks'

const CallExperience = lazy(() => import('./CallExperience').then((module) => ({ default: module.CallExperience })))

export function CallButton({
  person,
  phone,
  dealValue = 60000,
  stage = 'Qualified',
  label = 'Call',
  variant = 'secondary',
  onBegin,
}: {
  person: string
  phone?: string | null
  dealValue?: number
  stage?: string
  label?: string
  variant?: 'primary' | 'secondary' | 'icon'
  onBegin?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [confirmation, setConfirmation] = useState<string | null>(null)

  useEffect(() => {
    if (!confirmation) return
    const timer = window.setTimeout(() => setConfirmation(null), 2400)
    return () => window.clearTimeout(timer)
  }, [confirmation])

  const cls = variant === 'primary'
    ? 'h-12 border-accent bg-accent px-4 text-accent-fg shadow-[0_8px_22px_-14px_var(--accent)] hover:bg-accent-hover'
    : variant === 'icon'
      ? 'h-10 w-10 border-border-strong bg-surface text-accent hover:bg-accent-subtle'
      : 'h-12 border-border-strong bg-surface-raised px-3 text-accent shadow-elev-1 hover:bg-accent-subtle'

  return (
    <>
      <button
        onClick={(event) => { event.stopPropagation(); onBegin?.(); setOpen(true) }}
        aria-label={variant === 'icon' ? `Call ${person}` : undefined}
        className={['inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border text-xs font-semibold transition-[background-color,border-color,transform] hover:-translate-y-px active:translate-y-0', cls].join(' ')}
        title={`Preview click-to-call${phone ? ` · ${phone}` : ''}`}
      >
        <Phone aria-hidden size={15} />{variant !== 'icon' && label}
      </button>
      {open && <Suspense fallback={<div className="fixed inset-0 z-[80] flex items-center justify-center bg-[var(--overlay)]" role="status"><span className="rounded-lg bg-surface px-4 py-3 text-xs font-semibold text-fg shadow-elev-3">Preparing call brief…</span></div>}><CallExperience person={person} phone={phone ?? 'Preview number'} dealValue={dealValue} stage={stage} onClose={() => setOpen(false)} onComplete={(outcome: CallOutcomePreview, callbackAt?: string) => { setConfirmation(outcome === 'closed' ? `${person} closed · ₹${dealValue.toLocaleString('en-IN')} · +47 points` : outcome === 'callback' ? `Callback set · ${callbackAt} · +12 points` : outcome === 'objection' ? `${person} · call + objection logged · +17 points` : `${person} · call logged · +12 points`); setOpen(false) }} /></Suspense>}
      {confirmation && <div className="fixed right-4 bottom-24 z-[90] flex max-w-sm items-center gap-2 rounded-lg border border-[color-mix(in_srgb,var(--success)_28%,var(--border))] bg-surface-glass px-3 py-2.5 text-xs font-semibold text-success shadow-elev-3 backdrop-blur-xl" role="status"><Check aria-hidden size={15} />{confirmation}</div>}
    </>
  )
}
