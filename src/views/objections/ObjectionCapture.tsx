import { useEffect, useState } from 'react'
import { Check, CircleAlert, PhoneCall, RotateCcw, Sparkles, ThumbsDown, ThumbsUp } from 'lucide-react'
import { Button } from '../../ui/Button'
import { Sheet } from '../../ui/Sheet'
import { VoiceButton } from '../../ui/agent/VoiceButton'
import { useClient } from '../../shell/ClientProvider'
import { useAuth } from '../../auth/AuthProvider'
import { useObjectionTaxonomy, logObjection, undoObjection, saveNote } from '../../lib/objections-data'
import type { ObjectionTaxonomyRow } from '../../lib/objections-data'
import { useActiveScript, insertScriptUsage, updateScriptUsageFeedback, insertPlaybookGap } from '../../lib/scripts-data'
import type { ScriptParagraph } from '../../lib/scripts-data'
import { startCallSession, completeCall } from '../../lib/calls-data'
import type { CallOutcome } from '../../lib/calls-data'

const CALL_OUTCOME_KEY: Record<string, CallOutcome> = {
  Closed: 'closed',
  Progressing: 'progressing',
  Objection: 'objection',
  'No answer': 'no_answer',
}

function ScriptCopy({ paragraphs }: { paragraphs: ScriptParagraph[] }) {
  return (
    <div className="space-y-3">
      {paragraphs.map((paragraph, index) => (
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
  detected = null,
  leadId = null,
  conversationId = null,
  onInsertScript,
  compact = false,
}: {
  contactId: string
  source: 'chat' | 'crm'
  /** AI-detect chips are NOT wired (employee-core v1) — this stays whatever
   *  sample key the caller hardcodes; the "Detected" affordance below is a
   *  UI hint only, never written anywhere. */
  detected?: string | null
  leadId?: string | null
  conversationId?: string | null
  onInsertScript?: (text: string) => void
  compact?: boolean
}) {
  const { activeClient } = useClient()
  const { session } = useAuth()
  const clientId = activeClient?.id ?? null
  const actorId = session?.user.id ?? null

  const { items: taxonomy } = useObjectionTaxonomy(clientId)
  const [logged, setLogged] = useState<string | null>(null)
  const [loggedLogId, setLoggedLogId] = useState<string | null>(null)
  const [noteOpen, setNoteOpen] = useState(false)
  const [noteMode, setNoteMode] = useState<'gap' | 'note'>('note')
  const [note, setNote] = useState('')
  const [feedback, setFeedback] = useState<'worked' | 'missed' | null>(null)
  const [usageId, setUsageId] = useState<string | null>(null)
  const [gapFlagged, setGapFlagged] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [callOpen, setCallOpen] = useState(false)
  const [callStage, setCallStage] = useState<'pick' | 'objection'>('pick')
  const [callConfirm, setCallConfirm] = useState<string | null>(null)

  const { script: activeScript, loading: scriptLoading } = useActiveScript(clientId, logged)

  useEffect(() => {
    if (!callConfirm) return
    const t = window.setTimeout(() => setCallConfirm(null), 2400)
    return () => window.clearTimeout(t)
  }, [callConfirm])

  const choose = async (item: ObjectionTaxonomyRow) => {
    if (!clientId || !actorId) return
    setError(null)
    const res = await logObjection({
      clientId,
      contactId,
      conversationId,
      leadId,
      taxonomyId: item.id,
      source,
      actorId,
    })
    if (!res.ok) {
      setError(res.message)
      return
    }
    setLogged(item.id)
    setLoggedLogId(res.id)
    setFeedback(null)
    setUsageId(null)
    setGapFlagged(false)
  }

  const scriptText = activeScript
    ? activeScript.paragraphs.map((part) => `${part.before}${part.highlight ?? ''}${part.after ?? ''}`).join('\n\n')
    : ''

  const useTalkingPoints = async () => {
    if (!clientId || !actorId || !activeScript) return
    const res = await insertScriptUsage({
      clientId,
      scriptVersionId: activeScript.versionId,
      objectionLogId: loggedLogId,
      conversationId,
      actorId,
      insertedAsDraft: !!onInsertScript,
    })
    if (res.ok) setUsageId(res.id)
    else setError(res.message)
    onInsertScript?.(scriptText)
    setLogged(null)
  }

  const giveFeedback = async (value: 'worked' | 'missed') => {
    if (!clientId || !actorId || !activeScript) return
    let uid = usageId
    if (!uid) {
      const res = await insertScriptUsage({
        clientId,
        scriptVersionId: activeScript.versionId,
        objectionLogId: loggedLogId,
        conversationId,
        actorId,
        insertedAsDraft: false,
      })
      if (!res.ok) {
        setError(res.message)
        return
      }
      uid = res.id
      setUsageId(uid)
    }
    const res2 = await updateScriptUsageFeedback(clientId, uid, value === 'worked' ? 'worked' : 'didnt_work')
    if (res2.ok) setFeedback(value)
    else setError(res2.message ?? 'Could not save feedback.')
  }

  const flagGap = async () => {
    if (!clientId || !actorId || !logged) return
    const res = await insertPlaybookGap({
      clientId,
      taxonomyId: logged,
      objectionLogId: loggedLogId,
      exactCustomerWords: note || null,
      createdBy: actorId,
    })
    if (res.ok) setGapFlagged(true)
    else setError(res.message)
  }

  const saveNoteSheet = async () => {
    if (noteMode === 'gap') {
      await flagGap()
    } else if (noteMode === 'note' && clientId && loggedLogId) {
      const res = await saveNote(clientId, loggedLogId, note)
      if (!res.ok) setError(res.message ?? 'Could not save the note.')
    }
    setNoteOpen(false)
    setNote('')
  }

  const undo = async () => {
    if (!clientId || !actorId || !loggedLogId) return
    await undoObjection(clientId, loggedLogId, actorId)
    setLogged(null)
    setLoggedLogId(null)
    setUsageId(null)
    setFeedback(null)
    setGapFlagged(false)
  }

  const openCallSheet = () => {
    setCallOpen(true)
    setCallStage('pick')
  }

  const finishCallOutcome = async (outcome: CallOutcome, taxonomyKey?: string) => {
    if (!clientId || !actorId) return
    const sessionRes = await startCallSession({
      clientId,
      contactId,
      leadId,
      conversationId,
      actorId,
      surface: 'objection-capture',
      clientRequestId: crypto.randomUUID(),
    })
    if (!sessionRes.ok) {
      setError(sessionRes.message)
      setCallOpen(false)
      setCallStage('pick')
      return
    }
    const res = await completeCall(sessionRes.id, outcome, taxonomyKey ? { taxonomyKey } : undefined)
    setCallOpen(false)
    setCallStage('pick')
    if (!res.ok) {
      setError(res.message)
      return
    }
    setCallConfirm(outcome === 'objection' ? 'Call + objection logged' : 'Call logged')
  }

  const currentLabel = taxonomy.find((t) => t.id === logged)?.label ?? null

  return (
    <section className={compact ? 'border-t border-border bg-surface px-3 py-2.5 sm:px-4' : 'rounded-lg border border-dashed border-border-strong bg-surface-sunk/55 p-3'} aria-label="Objection capture">
      <div className="flex items-center justify-between gap-3">
        <p className="label-caps">Objection</p>
        {source === 'chat' && (
          <button onClick={() => void openCallSheet()} className="inline-flex min-h-7 items-center gap-1 rounded-md px-2 text-2xs font-semibold text-fg-muted hover:bg-surface-sunk hover:text-fg">
            <PhoneCall aria-hidden size={12} /> Log call result
          </button>
        )}
      </div>

      {error && <p className="mt-2 rounded-md bg-danger-subtle px-3 py-2 text-2xs font-semibold text-danger">{error}</p>}

      {detected && !logged && (
        <button
          onClick={() => { const item = taxonomy.find((t) => t.key === detected); if (item) void choose(item) }}
          className="mt-2 flex w-full items-center gap-2 rounded-md border border-[color-mix(in_srgb,var(--accent)_24%,var(--border))] bg-accent-subtle px-3 py-2 text-left text-xs font-semibold text-accent hover:bg-accent-soft"
        >
          <Sparkles aria-hidden size={14} />
          <span className="min-w-0 flex-1">Detected: {taxonomy.find((t) => t.key === detected)?.label ?? detected} — confirm?</span>
          <span className="rounded-pill bg-surface-raised px-2 py-1 text-2xs text-fg">One tap</span>
        </button>
      )}

      {logged && (
        <div className="mt-2 flex items-center gap-2 rounded-md bg-success-subtle px-3 py-2 text-xs text-success" role="status">
          <Check aria-hidden size={14} />
          <span className="min-w-0 flex-1 font-semibold">{currentLabel} objection logged</span>
          <button onClick={() => void undo()} className="inline-flex items-center gap-1 font-semibold hover:underline"><RotateCcw aria-hidden size={12} /> Undo</button>
        </div>
      )}

      <div className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto pb-0.5" role="group" aria-label="Log an objection">
        {taxonomy.map((item) => (
          <button
            key={item.id}
            onClick={() => void choose(item)}
            aria-pressed={logged === item.id}
            title="Tap to log and see the standard script"
            className={[
              'min-h-9 shrink-0 rounded-pill border px-3 text-xs font-semibold transition-colors',
              logged === item.id || (!logged && detected === item.key)
                ? 'border-accent bg-accent-subtle text-accent'
                : 'border-border bg-surface-raised text-fg-muted hover:border-border-strong hover:text-fg',
            ].join(' ')}
          >
            {item.label}{!logged && detected === item.key && <Sparkles aria-hidden size={10} className="ml-1 inline" />}
          </button>
        ))}
      </div>

      <Sheet open={!!logged && !noteOpen} onClose={() => setLogged(null)} title={activeScript ? `${currentLabel} counter-script` : scriptLoading ? 'Loading…' : 'No standard script yet'}>
        {activeScript ? (
          <div>
            <div className="flex items-center justify-between gap-3">
              <span className="label-caps text-accent">{activeScript.fallback ? 'Testing (no standard yet)' : 'Company standard'} · v{activeScript.version}</span>
            </div>
            <h3 className="mt-3 text-xl font-semibold tracking-[-0.035em] text-fg">{activeScript.headline}</h3>
            <div className="my-5 border-y border-border py-5"><ScriptCopy paragraphs={activeScript.paragraphs} /></div>
            <Button size="lg" className="w-full" onClick={() => void useTalkingPoints()}>
              {onInsertScript ? 'Insert as reply draft' : 'Use these talking points'}
            </Button>
            <button onClick={() => { setNoteMode('note'); setNoteOpen(true) }} className="mt-2 min-h-10 w-full rounded-md text-xs font-semibold text-fg-muted hover:bg-surface-sunk hover:text-fg">Add a note or voice note</button>
            <div className="mt-5 rounded-lg bg-surface-sunk p-3">
              <p className="text-xs font-semibold text-fg">Did it work?</p>
              <p className="mt-1 text-2xs text-fg-muted">One tap helps the team improve this script.</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button onClick={() => void giveFeedback('worked')} aria-pressed={feedback === 'worked'} className={['inline-flex min-h-10 items-center justify-center gap-1.5 rounded-md border text-xs font-semibold', feedback === 'worked' ? 'border-success bg-success-subtle text-success' : 'border-border bg-surface text-fg-muted'].join(' ')}><ThumbsUp aria-hidden size={14} /> Worked</button>
                <button onClick={() => void giveFeedback('missed')} aria-pressed={feedback === 'missed'} className={['inline-flex min-h-10 items-center justify-center gap-1.5 rounded-md border text-xs font-semibold', feedback === 'missed' ? 'border-danger bg-danger-subtle text-danger' : 'border-border bg-surface text-fg-muted'].join(' ')}><ThumbsDown aria-hidden size={14} /> Didn’t</button>
              </div>
            </div>
          </div>
        ) : scriptLoading ? null : gapFlagged ? (
          <div className="py-3 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-success-subtle text-success"><Check aria-hidden size={21} /></span>
            <h3 className="mt-4 text-lg font-semibold text-fg">Flagged for Monday’s review.</h3>
          </div>
        ) : (
          <div className="py-3 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-warn-subtle text-warn"><CircleAlert aria-hidden size={21} /></span>
            <h3 className="mt-4 text-lg font-semibold text-fg">This objection is new.</h3>
            <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-fg-muted">There is no company standard yet. Add the customer’s words and flag it for Monday’s manager review.</p>
            <Button className="mt-5 w-full" onClick={() => { setNoteMode('gap'); setNoteOpen(true) }}>Add note and flag to manager</Button>
          </div>
        )}
      </Sheet>

      <Sheet open={noteOpen} onClose={() => setNoteOpen(false)} title="Add context (optional)">
        <p className="text-xs leading-relaxed text-fg-muted">Keep it to one line. The objection was already logged, so this never blocks the flow.</p>
        <div className="mt-4 flex items-end gap-2">
          <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} autoFocus placeholder="Customer’s exact words…" aria-label="Objection note" className="min-h-24 min-w-0 flex-1 resize-none rounded-md border border-border bg-surface-raised p-3 text-sm text-fg placeholder:text-fg-subtle" />
          <VoiceButton onTranscript={setNote} compact />
        </div>
        <Button className="mt-4 w-full" onClick={() => void saveNoteSheet()}>Save context</Button>
      </Sheet>

      <Sheet open={callOpen} onClose={() => setCallOpen(false)} title="How did it go?">
        <p className="text-xs text-fg-muted">Fast enough to capture before the next call. Dismiss anytime.</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {['Closed', 'Progressing', 'Objection', 'No answer'].map((outcomeLabel) => (
            <button
              key={outcomeLabel}
              onClick={() => { if (outcomeLabel === 'Objection') { setCallStage('objection'); return } void finishCallOutcome(CALL_OUTCOME_KEY[outcomeLabel]) }}
              aria-pressed={callStage === 'objection' && outcomeLabel === 'Objection'}
              className={['min-h-12 rounded-md border text-sm font-semibold', callStage === 'objection' && outcomeLabel === 'Objection' ? 'border-accent bg-accent-subtle text-accent' : 'border-border bg-surface-raised text-fg-muted hover:border-border-strong hover:text-fg'].join(' ')}
            >
              {outcomeLabel}
            </button>
          ))}
        </div>
        {callStage === 'objection' && (
          <div className="mt-4 border-t border-border pt-4">
            <p className="label-caps">What stopped them?</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {taxonomy.map((item) => <button key={item.id} onClick={() => void finishCallOutcome('objection', item.key)} className="min-h-9 rounded-pill border border-border px-3 text-xs font-semibold text-fg-muted hover:border-accent hover:text-accent">{item.label}</button>)}
            </div>
          </div>
        )}
        <button onClick={() => { setCallOpen(false); setCallStage('pick') }} className="mt-3 min-h-10 w-full text-xs font-semibold text-fg-subtle hover:text-fg">Not now</button>
      </Sheet>
      {callConfirm && <div className="fixed right-4 bottom-24 z-[90] flex max-w-sm items-center gap-2 rounded-lg border border-[color-mix(in_srgb,var(--success)_28%,var(--border))] bg-surface-glass px-3 py-2.5 text-xs font-semibold text-success shadow-elev-3 backdrop-blur-xl" role="status"><Check aria-hidden size={15} />{callConfirm}</div>}
    </section>
  )
}
