import { useMemo, useState } from 'react'
import { Check, CircleAlert, PhoneCall, Plus, RotateCcw, Sparkles, ThumbsDown, ThumbsUp } from 'lucide-react'
import { Button } from '../../ui/Button'
import { Sheet } from '../../ui/Sheet'
import { VoiceButton } from '../../ui/agent/VoiceButton'
import { OBJECTION_LABELS, OBJECTION_SCRIPTS } from './objectionMocks'
import type { ObjectionKey, ObjectionScriptPreview } from './objectionMocks'

function ScriptCopy({ script }: { script: ObjectionScriptPreview }) {
  return (
    <div className="space-y-3">
      {script.paragraphs.map((paragraph, index) => (
        <p key={index} className="text-sm leading-7 text-fg-muted">
          {paragraph.before}
          {paragraph.highlight && <mark className="rounded-xs bg-[color-mix(in_srgb,var(--signal)_32%,transparent)] px-0.5 font-semibold text-fg">{paragraph.highlight}</mark>}
          {paragraph.after}
        </p>
      ))}
    </div>
  )
}

export function ObjectionCapture({
  contactId,
  source,
  detected = 'price',
  onInsertScript,
  compact = false,
}: {
  contactId: string
  source: 'chat' | 'crm'
  detected?: ObjectionKey | null
  onInsertScript?: (text: string) => void
  compact?: boolean
}) {
  const [logged, setLogged] = useState<ObjectionKey | null>(null)
  const [scriptKey, setScriptKey] = useState<ObjectionKey | null>(null)
  const [noteOpen, setNoteOpen] = useState(false)
  const [callOpen, setCallOpen] = useState(false)
  const [note, setNote] = useState('')
  const [feedback, setFeedback] = useState<'worked' | 'missed' | null>(null)
  const [callOutcome, setCallOutcome] = useState<string | null>(null)

  const activeScript = useMemo(
    () => OBJECTION_SCRIPTS.find((item) => item.key === scriptKey) ?? null,
    [scriptKey],
  )

  const choose = (key: ObjectionKey) => {
    setLogged(key)
    setScriptKey(key)
    setFeedback(null)
  }

  const scriptText = activeScript
    ? activeScript.paragraphs.map((part) => `${part.before}${part.highlight ?? ''}${part.after ?? ''}`).join('\n\n')
    : ''

  return (
    <section className={compact ? 'border-t border-border bg-surface px-3 py-2.5 sm:px-4' : 'rounded-lg border border-dashed border-border-strong bg-surface-sunk/55 p-3'} aria-label="Objection capture preview">
      <div className="flex items-center justify-between gap-3">
        <p className="label-caps">Objection · Preview</p>
        {source === 'chat' && (
          <button onClick={() => setCallOpen(true)} className="inline-flex min-h-7 items-center gap-1 rounded-md px-2 text-2xs font-semibold text-fg-muted hover:bg-surface-sunk hover:text-fg">
            <PhoneCall aria-hidden size={12} /> Log call result
          </button>
        )}
      </div>

      {detected && !logged && (
        <button
          onClick={() => choose(detected)}
          className="mt-2 flex w-full items-center gap-2 rounded-md border border-[color-mix(in_srgb,var(--accent)_24%,var(--border))] bg-accent-subtle px-3 py-2 text-left text-xs font-semibold text-accent hover:bg-accent-soft"
        >
          <Sparkles aria-hidden size={14} />
          <span className="min-w-0 flex-1">Detected: {OBJECTION_LABELS.find((item) => item.key === detected)?.label} — confirm?</span>
          <span className="rounded-pill bg-surface-raised px-2 py-1 text-2xs text-fg">One tap</span>
        </button>
      )}

      {logged && (
        <div className="mt-2 flex items-center gap-2 rounded-md bg-success-subtle px-3 py-2 text-xs text-success" role="status">
          <Check aria-hidden size={14} />
          <span className="min-w-0 flex-1 font-semibold">+5 · {OBJECTION_LABELS.find((item) => item.key === logged)?.label} objection logged</span>
          <button onClick={() => { setLogged(null); setScriptKey(null) }} className="inline-flex items-center gap-1 font-semibold hover:underline"><RotateCcw aria-hidden size={12} /> Undo</button>
        </div>
      )}

      <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5" role="group" aria-label="Log an objection">
        {OBJECTION_LABELS.map((item) => (
          <button
            key={item.key}
            onClick={() => choose(item.key)}
            aria-pressed={logged === item.key}
            title="Tap to log and see the standard script"
            className={[
              'min-h-9 shrink-0 rounded-pill border px-3 text-xs font-semibold transition-colors',
              logged === item.key || (!logged && detected === item.key)
                ? 'border-accent bg-accent-subtle text-accent'
                : 'border-border bg-surface-raised text-fg-muted hover:border-border-strong hover:text-fg',
            ].join(' ')}
          >
            {item.label}{!logged && detected === item.key && <Sparkles aria-hidden size={10} className="ml-1 inline" />}
          </button>
        ))}
        <button onClick={() => { setScriptKey('custom'); setNoteOpen(true) }} aria-label="Add custom objection" className="flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-pill border border-dashed border-border-strong text-fg-muted hover:border-accent hover:text-accent"><Plus aria-hidden size={14} /></button>
      </div>

      <Sheet open={!!scriptKey && !noteOpen} onClose={() => setScriptKey(null)} title={activeScript ? `${activeScript.label} counter-script` : 'No standard script yet'}>
        {activeScript ? (
          <div>
            <div className="flex items-center justify-between gap-3">
              <span className="label-caps text-accent">Company standard · v{activeScript.version}</span>
              <span className="text-2xs text-fg-muted">Preview — not wired</span>
            </div>
            <h3 className="mt-3 text-xl font-semibold tracking-[-0.035em] text-fg">{activeScript.headline}</h3>
            <div className="my-5 border-y border-border py-5"><ScriptCopy script={activeScript} /></div>
            <Button size="lg" className="w-full" onClick={() => { if (onInsertScript) onInsertScript(scriptText); setScriptKey(null) }}>
              {onInsertScript ? 'Insert as reply draft' : 'Use these talking points'}
            </Button>
            <button onClick={() => setNoteOpen(true)} className="mt-2 min-h-10 w-full rounded-md text-xs font-semibold text-fg-muted hover:bg-surface-sunk hover:text-fg">Add a note or voice note</button>
            <div className="mt-5 rounded-lg bg-surface-sunk p-3">
              <p className="text-xs font-semibold text-fg">Did it work?</p>
              <p className="mt-1 text-2xs text-fg-muted">One tap helps the team improve this script.</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button onClick={() => setFeedback('worked')} aria-pressed={feedback === 'worked'} className={['inline-flex min-h-10 items-center justify-center gap-1.5 rounded-md border text-xs font-semibold', feedback === 'worked' ? 'border-success bg-success-subtle text-success' : 'border-border bg-surface text-fg-muted'].join(' ')}><ThumbsUp aria-hidden size={14} /> Worked</button>
                <button onClick={() => setFeedback('missed')} aria-pressed={feedback === 'missed'} className={['inline-flex min-h-10 items-center justify-center gap-1.5 rounded-md border text-xs font-semibold', feedback === 'missed' ? 'border-danger bg-danger-subtle text-danger' : 'border-border bg-surface text-fg-muted'].join(' ')}><ThumbsDown aria-hidden size={14} /> Didn’t</button>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-3 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-warn-subtle text-warn"><CircleAlert aria-hidden size={21} /></span>
            <h3 className="mt-4 text-lg font-semibold text-fg">This objection is new.</h3>
            <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-fg-muted">There is no company standard yet. Add the customer’s words and flag it for Monday’s manager review.</p>
            <Button className="mt-5 w-full" onClick={() => setNoteOpen(true)}>Add note and flag to manager</Button>
          </div>
        )}
      </Sheet>

      <Sheet open={noteOpen} onClose={() => setNoteOpen(false)} title="Add context (optional)">
        <p className="text-xs leading-relaxed text-fg-muted">Keep it to one line. The objection was already logged, so this never blocks the flow.</p>
        <div className="mt-4 flex items-end gap-2">
          <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} autoFocus placeholder="Customer’s exact words…" aria-label="Objection note" className="min-h-24 min-w-0 flex-1 resize-none rounded-md border border-border bg-surface-raised p-3 text-sm text-fg placeholder:text-fg-subtle" />
          <VoiceButton onTranscript={setNote} compact />
        </div>
        <Button className="mt-4 w-full" onClick={() => { if (scriptKey === 'custom') setLogged('custom'); setNoteOpen(false); if (scriptKey === 'custom') setScriptKey(null) }}>Save context</Button>
        <p className="mt-2 text-center text-2xs text-fg-subtle">Preview — note and audio are not saved</p>
      </Sheet>

      <Sheet open={callOpen} onClose={() => setCallOpen(false)} title="How did it go?">
        <p className="text-xs text-fg-muted">Fast enough to capture before the next call. Dismiss anytime.</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {['Closed', 'Progressing', 'Objection', 'No answer'].map((outcome) => (
            <button key={outcome} onClick={() => { setCallOutcome(outcome); if (outcome === 'Objection') return; setCallOpen(false) }} aria-pressed={callOutcome === outcome} className={['min-h-12 rounded-md border text-sm font-semibold', callOutcome === outcome ? 'border-accent bg-accent-subtle text-accent' : 'border-border bg-surface-raised text-fg-muted hover:border-border-strong hover:text-fg'].join(' ')}>{outcome}</button>
          ))}
        </div>
        {callOutcome === 'Objection' && (
          <div className="mt-4 border-t border-border pt-4">
            <p className="label-caps">What stopped them?</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {OBJECTION_LABELS.map((item) => <button key={item.key} onClick={() => { setCallOpen(false); choose(item.key) }} className="min-h-9 rounded-pill border border-border px-3 text-xs font-semibold text-fg-muted hover:border-accent hover:text-accent">{item.label}</button>)}
            </div>
          </div>
        )}
        <button onClick={() => setCallOpen(false)} className="mt-3 min-h-10 w-full text-xs font-semibold text-fg-subtle hover:text-fg">Not now</button>
      </Sheet>
      <span className="sr-only">Contact {contactId}; source {source}; sample data only.</span>
    </section>
  )
}
