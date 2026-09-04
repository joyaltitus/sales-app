import { lazy, Suspense, useEffect, useState } from 'react'
import { Check, Phone } from 'lucide-react'
import type { CallOutcome } from './CallExperience'
import { formatINR } from '../../ui/formatMoney'

const CallExperience = lazy(() => import('./CallExperience').then((module) => ({ default: module.CallExperience })))

export function CallButton({
  person,
  phone,
  dealValue = null,
  stage = null,
  label = 'Call',
  variant = 'secondary',
  onBegin,
  contactId,
  leadId = null,
  conversationId = null,
}: {
  person: string
  phone?: string | null
  dealValue?: number | null
  stage?: string | null
  label?: string
  variant?: 'primary' | 'secondary' | 'icon'
  onBegin?: () => void
  contactId: string
  leadId?: string | null
  conversationId?: string | null
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
        title={`Call${phone ? ` · ${phone}` : ''}`}
      >
        <Phone aria-hidden size={15} />{variant !== 'icon' && label}
      </button>
      {open && (
        <Suspense fallback={<div className="fixed inset-0 z-[80] flex items-center justify-center bg-[var(--overlay)]" role="status"><span className="rounded-lg bg-surface px-4 py-3 text-xs font-semibold text-fg shadow-elev-3">Preparing call brief…</span></div>}>
          <CallExperience
            person={person}
            phone={phone ?? ''}
            dealValue={dealValue}
            stage={stage}
            contactId={contactId}
            leadId={leadId}
            conversationId={conversationId}
            onClose={() => setOpen(false)}
            onComplete={(outcome: CallOutcome, callbackAt?: string) => {
              setConfirmation(
                outcome === 'closed' ? `${person} · closed${dealValue ? ` · ${formatINR(dealValue)}` : ''}` :
                outcome === 'callback' ? `Callback set · ${callbackAt}` :
                outcome === 'objection' ? `${person} · call + objection logged` :
                `${person} · call logged`,
              )
              setOpen(false)
            }}
          />
        </Suspense>
      )}
      {confirmation && <div className="fixed right-4 bottom-24 z-[90] flex max-w-sm items-center gap-2 rounded-lg border border-[color-mix(in_srgb,var(--success)_28%,var(--border))] bg-surface-glass px-3 py-2.5 text-xs font-semibold text-success shadow-elev-3 backdrop-blur-xl" role="status"><Check aria-hidden size={15} />{confirmation}</div>}
    </>
  )
}
