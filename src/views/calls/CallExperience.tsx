import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Clock3, Phone, PhoneOff, UserRound } from 'lucide-react'
import { Button } from '../../ui/Button'
import { Sheet } from '../../ui/Sheet'
import { VoiceButton } from '../../ui/agent/VoiceButton'
import { useClient } from '../../shell/ClientProvider'
import { useAuth } from '../../auth/AuthProvider'
import { useObjectionTaxonomy, useObjectionLogs } from '../../lib/objections-data'
import { startCallSession, completeCall, useCallLogs } from '../../lib/calls-data'
import { formatINR } from '../../ui/formatMoney'

export type CallOutcome = 'closed' | 'progressing' | 'objection' | 'no_answer' | 'callback'

const CALL_OUTCOME_LABEL: Record<string, string> = {
  closed: 'Closed', progressing: 'Progressing', objection: 'Objection', no_answer: 'No answer', callback: 'Callback',
}

function callbackOptions() {
  const at = (hour: number, addDays = 0) => {
    const d = new Date()
    d.setDate(d.getDate() + addDays)
    d.setHours(hour, 0, 0, 0)
    return d
  }
  const now = new Date()
  const fourPm = at(16)
  const sixPm = at(18)
  return [
    { label: '4:00 pm', at: fourPm < now ? at(16, 1) : fourPm },
    { label: '6:00 pm', at: sixPm < now ? at(18, 1) : sixPm },
    { label: 'Tomorrow 10am', at: at(10, 1) },
  ]
}

export function CallExperience({
  person,
  phone,
  dealValue,
  stage,
  contactId,
  leadId = null,
  conversationId = null,
  onClose,
  onComplete,
}: {
  person: string
  phone: string
  dealValue: number | null
  stage: string | null
  contactId: string
  leadId?: string | null
  conversationId?: string | null
  onClose: () => void
  onComplete: (outcome: CallOutcome, callbackAt?: string) => void
}) {
  const { activeClient } = useClient()
  const { session } = useAuth()
  const clientId = activeClient?.id ?? null
  const actorId = session?.user.id ?? null

  const { items: taxonomy } = useObjectionTaxonomy(clientId)
  const { items: objectionLogs } = useObjectionLogs(clientId, contactId)
  const { items: callLogs } = useCallLogs(clientId, contactId)

  const [step, setStep] = useState<'brief' | 'calling' | 'outcome'>('brief')
  const [outcome, setOutcome] = useState<CallOutcome | null>(null)
  const [note, setNote] = useState('')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  // ONE id per opened call sheet. startCallSession upserts on
  // (client_id, client_request_id); minting inside the handler made that upsert
  // a no-op guard — a double-tapped Start call, or a retry after a response we
  // never saw, forked a second call_sessions row for one real call. This sheet
  // mounts per open, so a mount-time ref is one id per call. Pattern lifted from
  // extension/app/App.tsx, which has always done this correctly.
  const callRequestId = useRef(crypto.randomUUID())

  const openObjection = objectionLogs.find((o) => !o.resolved) ?? null
  const lastTouchpoints = callLogs.slice(0, 3).map((c) => ({
    channel: 'call' as const,
    summary: `${CALL_OUTCOME_LABEL[c.outcome] ?? c.outcome}${c.note ? ' — ' + c.note : ''}`,
    at: new Date(c.occurred_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }),
  }))

  const beginCall = async () => {
    if (!clientId || !actorId) {
      setError('The call could not be started. Refresh the page and try again.')
      return
    }
    const res = await startCallSession({
      clientId, contactId, leadId, conversationId, actorId,
      surface: 'call-button', requestedNumber: phone, clientRequestId: callRequestId.current,
    })
    if (!res.ok) {
      setError(res.message)
      return
    }
    setSessionId(res.id)
    setStep('calling')
  }

  useEffect(() => {
    if (step === 'calling' && phone) {
      window.location.href = `tel:${phone}`
    }
  }, [step, phone])

  const finish = async (value: CallOutcome, opts?: { callbackAt?: Date; taxonomyKey?: string }) => {
    setSaving(true)
    if (!sessionId) {
      setSaving(false)
      setError('The call session is missing. Close this panel and start the call again.')
      return
    }
    const res = await completeCall(sessionId, value, {
      taxonomyKey: opts?.taxonomyKey ?? null,
      callbackAt: opts?.callbackAt ? opts.callbackAt.toISOString() : null,
      note: note || null,
    })
    setSaving(false)
    if (!res.ok) {
      setError(res.message)
      return
    }
    onComplete(value, opts?.callbackAt ? opts.callbackAt.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : undefined)
  }

  const callbacks = useMemo(callbackOptions, [])

  return (
    <Sheet open onClose={onClose} title={step === 'brief' ? 'Call brief' : step === 'calling' ? `Calling ${person}` : 'Outcome'}>
      {error && <p className="mb-3 rounded-md bg-danger-subtle px-3 py-2 text-2xs font-semibold text-danger">{error}</p>}

      {step === 'brief' && <div>
        <div className="flex items-start justify-between gap-3"><div><p className="label-caps text-accent">Call brief</p><h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-fg">{person}</h3><p className="mt-1 text-xs text-fg-muted">{[phone || 'No phone number', stage].filter(Boolean).join(' · ')}</p></div>{dealValue ? <div className="text-right"><strong className="tnum block text-xl text-fg">{formatINR(dealValue)}</strong><span className="text-2xs text-fg-muted">Deal value</span></div> : null}</div>
        <section className="mt-5"><p className="label-caps">Recent calls</p>{lastTouchpoints.length === 0 ? <p className="mt-2 text-xs text-fg-subtle">No prior calls on record.</p> : <ol className="mt-2 space-y-2">{lastTouchpoints.map((touch, i) => <li key={i} className="flex gap-3 rounded-lg bg-surface-sunk p-3"><span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface text-accent"><UserRound aria-hidden size={13} /></span><span className="text-xs leading-relaxed text-fg-muted"><strong className="block font-semibold text-fg">{touch.summary}</strong>{touch.at} · {touch.channel}</span></li>)}</ol>}</section>
        {openObjection && <section className="mt-5 rounded-lg border border-border bg-surface p-4 shadow-elev-1"><p className="text-xs font-medium text-warn">Open objection · {openObjection.taxonomyLabel}</p>{openObjection.note && <p className="mt-2 text-sm leading-relaxed text-fg">{openObjection.note}</p>}</section>}
        <Button size="lg" className="mt-5 w-full" onClick={() => void beginCall()} disabled={!phone}><Phone aria-hidden size={16} /> Start call</Button>
        <p className="mt-2 text-center text-2xs text-fg-subtle">{phone ? "Opens your phone's dialer." : 'Add a phone number before calling.'}</p>
      </div>}

      {step === 'calling' && <div className="py-8 text-center"><span className="relative mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-success-subtle text-success"><span className="absolute inset-0 animate-ping rounded-full border border-success opacity-20 motion-reduce:animate-none" /><Phone aria-hidden size={34} /></span><p className="mt-6 text-xs font-medium text-success">Call in progress</p><h3 className="mt-2 text-2xl font-semibold text-fg">{person}</h3><p className="mt-1 text-sm text-fg-muted">{phone}</p><Button size="lg" variant="danger" className="mt-8 w-full" onClick={() => setStep('outcome')}><PhoneOff aria-hidden size={16} /> Return to app</Button><p className="mt-2 text-2xs text-fg-subtle">The outcome sheet opens automatically on return.</p></div>}

      {step === 'outcome' && <div>
        <div className="rounded-lg bg-surface-sunk p-3"><p className="text-xs font-medium text-fg-muted">Call complete</p><p className="mt-1 text-sm font-semibold text-fg">{person}{dealValue ? ` · ${formatINR(dealValue)}` : ''}</p></div>
        <p className="mt-5 text-xs font-semibold text-fg">Outcome</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button disabled={saving} onClick={() => void finish('closed')} className="col-span-2 flex min-h-14 items-center justify-center gap-2 rounded-lg border border-success bg-success-subtle text-sm font-semibold text-success disabled:opacity-60"><Check aria-hidden size={17} /> Closed{dealValue ? ` · ${formatINR(dealValue)}` : ''}</button>
          {[['progressing', 'Progressing'], ['objection', 'Objection'], ['no_answer', 'No answer'], ['callback', 'Callback at…']].map(([value, label]) => <button key={value} disabled={saving} onClick={() => value === 'progressing' || value === 'no_answer' ? void finish(value as CallOutcome) : setOutcome(value as CallOutcome)} aria-pressed={outcome === value} className={['min-h-12 rounded-lg border text-sm font-semibold disabled:opacity-60', outcome === value ? 'border-accent bg-accent-subtle text-accent' : 'border-border bg-surface-raised text-fg-muted hover:border-border-strong hover:text-fg'].join(' ')}>{label}</button>)}
        </div>
        {outcome === 'objection' && <div className="mt-4 border-t border-border pt-4"><p className="label-caps">What stopped them?</p><div className="mt-2 flex flex-wrap gap-1.5">{taxonomy.map((item) => <button key={item.key} disabled={saving} onClick={() => void finish('objection', { taxonomyKey: item.key })} className="min-h-9 rounded-pill border border-border px-3 text-xs font-semibold text-fg-muted hover:border-accent hover:text-accent disabled:opacity-60">{item.label}</button>)}</div>{taxonomy.length === 0 && <p className="mt-2 text-xs text-fg-muted">No objection categories are configured.</p>}</div>}
        {outcome === 'callback' && <div className="mt-4 border-t border-border pt-4"><p className="label-caps flex items-center gap-1"><Clock3 aria-hidden size={12} /> Callback when?</p><div className="mt-2 grid grid-cols-3 gap-2">{callbacks.map((c) => <button key={c.label} disabled={saving} onClick={() => void finish('callback', { callbackAt: c.at })} className="min-h-10 rounded-md border border-border bg-surface text-xs font-semibold text-fg-muted hover:border-accent hover:text-accent disabled:opacity-60">{c.label}</button>)}</div><p className="mt-2 text-2xs text-fg-subtle">The callback will appear on Today as a follow-up.</p></div>}
        <div className="mt-5 flex items-center gap-3 rounded-lg border border-dashed border-border-strong p-3"><VoiceButton compact onTranscript={setNote} /><div className="min-w-0"><p className="text-xs font-semibold text-fg">Optional voice note</p><p className="mt-0.5 truncate text-2xs text-fg-muted">{note || 'Capture context without slowing down.'}</p></div>{note && <Check aria-hidden size={15} className="ml-auto text-success" />}</div>
        <button onClick={onClose} className="mt-3 min-h-10 w-full text-xs font-semibold text-fg-subtle hover:text-fg">Dismiss without logging</button>
      </div>}
    </Sheet>
  )
}
