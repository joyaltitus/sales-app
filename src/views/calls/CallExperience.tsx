import { useMemo, useState } from 'react'
import { Check, Clock3, PartyPopper, Phone, PhoneOff, Sparkles, Target, UserRound } from 'lucide-react'
import { Button } from '../../ui/Button'
import { Sheet } from '../../ui/Sheet'
import { VoiceButton } from '../../ui/agent/VoiceButton'
import { OBJECTION_LABELS } from '../objections/objectionMocks'
import { PREVIEW_DEAL_BRIEF } from './callMocks'
import type { CallOutcomePreview, DealBriefPreview } from './callMocks'
import { formatINR } from '../../ui/formatMoney'

export function CallExperience({ person, phone, dealValue, stage, onClose, onComplete }: { person: string; phone: string; dealValue: number; stage: string; onClose: () => void; onComplete: (outcome: CallOutcomePreview, callbackAt?: string) => void }) {
  const [step, setStep] = useState<'brief' | 'calling' | 'outcome'>('brief')
  const [outcome, setOutcome] = useState<CallOutcomePreview | null>(null)
  const [note, setNote] = useState('')
  const brief = useMemo<DealBriefPreview>(() => ({ ...PREVIEW_DEAL_BRIEF, name: person, value: dealValue, stage }), [person, dealValue, stage])

  const finish = (value: CallOutcomePreview, callbackAt?: string) => onComplete(value, callbackAt)

  return (
    <Sheet open onClose={onClose} title={step === 'brief' ? '15-second deal brief' : step === 'calling' ? `Calling ${person}` : 'How did it go?'}>
      {step === 'brief' && <div>
        <div className="flex items-start justify-between gap-3"><div><p className="label-caps text-accent">Copilot brief · Preview</p><h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-fg">{person}</h3><p className="mt-1 text-xs text-fg-muted">{phone} · {stage}</p></div><div className="text-right"><strong className="tnum block text-xl text-fg">{formatINR(dealValue)}</strong><span className="text-2xs text-fg-muted">deal value</span></div></div>
        <div className="mt-5 rounded-xl border border-[color-mix(in_srgb,var(--accent)_22%,var(--border))] bg-accent-subtle p-4"><p className="flex items-center gap-1.5 text-xs font-semibold text-accent"><Target aria-hidden size={14} /> Goal for this call</p><p className="mt-2 text-sm font-semibold leading-relaxed text-fg">{brief.recommendedGoal}</p></div>
        <section className="mt-5"><p className="label-caps">Last three touchpoints</p><ol className="mt-2 space-y-2">{brief.lastTouchpoints.map((touch) => <li key={touch.at} className="flex gap-3 rounded-lg bg-surface-sunk p-3"><span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface text-accent"><UserRound aria-hidden size={13} /></span><span className="text-xs leading-relaxed text-fg-muted"><strong className="block font-semibold text-fg">{touch.summary}</strong>{touch.at} · {touch.channel}</span></li>)}</ol></section>
        {brief.openObjection && <section className="mt-5 rounded-lg border border-border bg-surface p-4 shadow-elev-1"><div className="flex items-center justify-between"><p className="label-caps text-warn">Open objection · {brief.openObjection.label}</p><span className="text-2xs text-fg-subtle">Standard v4</span></div><p className="mt-2 text-sm leading-relaxed text-fg">{brief.openObjection.counter}</p></section>}
        <Button size="lg" className="mt-5 w-full" onClick={() => setStep('calling')}><Phone aria-hidden size={16} /> Start mock call</Button>
        <p className="mt-2 text-center text-2xs text-fg-subtle">Preview — no phone connection is made</p>
      </div>}

      {step === 'calling' && <div className="py-8 text-center"><span className="relative mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-success-subtle text-success"><span className="absolute inset-0 animate-ping rounded-full border border-success opacity-20 motion-reduce:animate-none" /><Phone aria-hidden size={34} /></span><p className="label-caps mt-6 text-success">Click-to-call preview</p><h3 className="mt-2 text-2xl font-semibold text-fg">{person}</h3><p className="mt-1 text-sm text-fg-muted">{phone}</p><p className="tnum mt-5 text-xl text-fg">00:42</p><Button size="lg" variant="danger" className="mt-8 w-full" onClick={() => setStep('outcome')}><PhoneOff aria-hidden size={16} /> Return to app</Button><p className="mt-2 text-2xs text-fg-subtle">The outcome sheet opens automatically on return.</p></div>}

      {step === 'outcome' && <div>
        <div className="rounded-lg bg-surface-sunk p-3"><p className="label-caps">Call complete · 6m 12s</p><p className="mt-1 text-sm font-semibold text-fg">{person} · {formatINR(dealValue)}</p></div>
        <p className="mt-5 text-xs font-semibold text-fg">One tap for the outcome. Two only when details matter.</p><p className="mt-1 text-2xs font-semibold text-success">+12 behavior points when the call is logged · daily cap applies</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={() => finish('closed')} className="col-span-2 flex min-h-14 items-center justify-center gap-2 rounded-lg border border-success bg-success-subtle text-sm font-semibold text-success"><PartyPopper aria-hidden size={17} /> Closed · {formatINR(dealValue)}</button>
          {[['progressing', 'Progressing'], ['objection', 'Objection'], ['no_answer', 'No answer'], ['callback', 'Callback at…']].map(([value, label]) => <button key={value} onClick={() => value === 'progressing' || value === 'no_answer' ? finish(value as CallOutcomePreview) : setOutcome(value as CallOutcomePreview)} aria-pressed={outcome === value} className={['min-h-12 rounded-lg border text-sm font-semibold', outcome === value ? 'border-accent bg-accent-subtle text-accent' : 'border-border bg-surface-raised text-fg-muted hover:border-border-strong hover:text-fg'].join(' ')}>{label}</button>)}
        </div>
        {outcome === 'objection' && <div className="mt-4 border-t border-border pt-4"><p className="label-caps">What stopped them?</p><div className="mt-2 flex flex-wrap gap-1.5">{OBJECTION_LABELS.map((item) => <button key={item.key} onClick={() => finish('objection')} className="min-h-9 rounded-pill border border-border px-3 text-xs font-semibold text-fg-muted hover:border-accent hover:text-accent">{item.label}</button>)}</div></div>}
        {outcome === 'callback' && <div className="mt-4 border-t border-border pt-4"><p className="label-caps flex items-center gap-1"><Clock3 aria-hidden size={12} /> Callback when?</p><div className="mt-2 grid grid-cols-3 gap-2">{['4:00 pm', '6:00 pm', 'Tomorrow 10am'].map((time) => <button key={time} onClick={() => finish('callback', time)} className="min-h-10 rounded-md border border-border bg-surface text-xs font-semibold text-fg-muted hover:border-accent hover:text-accent">{time}</button>)}</div><p className="mt-2 text-2xs text-fg-subtle">The callback will appear on Today as a follow-up.</p></div>}
        <div className="mt-5 flex items-center gap-3 rounded-lg border border-dashed border-border-strong p-3"><VoiceButton compact onTranscript={setNote} /><div className="min-w-0"><p className="text-xs font-semibold text-fg">Optional voice note</p><p className="mt-0.5 truncate text-2xs text-fg-muted">{note || 'Capture context without slowing down.'}</p></div>{note && <Check aria-hidden size={15} className="ml-auto text-success" />}</div>
        <button onClick={onClose} className="mt-3 min-h-10 w-full text-xs font-semibold text-fg-subtle hover:text-fg">Dismiss without logging</button>
      </div>}
      <span className="sr-only"><Sparkles />Brief data is sample only.</span>
    </Sheet>
  )
}
