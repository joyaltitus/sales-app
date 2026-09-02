import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarClock, CreditCard, Quote, TriangleAlert } from 'lucide-react'
import type { PersonalSpin, PlaybookLibrary, QueueItem, Rebuttal } from '../lib/contracts'
import type { PanelIdentity } from '../lib/panel-data'
import { spinsFor } from '../lib/panel-data'
import {
  COMPOSED_KEYS, DEFAULT_LANG, buildRoadmap, composedScript, hookVariant, objectionScripts,
  pickScript, toText, type HookKey, type PickedScript, type RoadmapStep,
} from '../lib/script-text'
import { courseVars, needsCourse } from '../lib/course-vars'
import { buildUpiIntent, callbackWhen, canCollect, payVars, tokenAmount, zonedIso } from '../lib/pay-link'
import { renderSnippet } from '../lib/snippet'
import { isWideSurface } from '../lib/surface'
import { loadPrefs, loadSnippets, rememberCourse, rememberStage, savePrefs, type SavedSnippet } from '../lib/prefs'
import { queueWrite } from '../lib/outbox-store'
import { openCallTab } from '../lib/background'
import { ObjectionChips } from './ObjectionChips'
import { RebuttalCard } from './RebuttalCard'
import { RoadmapStage } from './RoadmapStage'
import { ScriptSheet } from './ScriptSheet'
import { insertWithFallback } from './SnippetBar'
import { Button } from '../../src/ui/Button'

export type UsageRecord = {
  usageId: string
  versionId: string
  label: string
  feedback: 'worked' | 'didnt_work' | null
}

type Props = {
  identity: PanelIdentity
  lead: QueueItem
  library: PlaybookLibrary
  /** Prior call logs — decides which opener the roadmap prefills. */
  calls: readonly unknown[]
  /** The call session an insert belongs to, when the rep started one. */
  callSessionId: string | null
  /** Turns on right after an outcome is logged: time to rate what was used. */
  ratingOpen: boolean
  onResult: (message: string) => void
  /** Lock callback rides the existing OutcomeBar follow-up + callback path. */
  onLockCallback: (atIso: string) => Promise<boolean>
  busy?: boolean
  /**
   * 'column' is the 380px side panel; 'wide' is the full browser tab. Omitted,
   * it follows the mount. Tests always pass it, so neither layout can drift
   * into being the untested one.
   */
  layout?: 'column' | 'wide'
}

const selectClass =
  'h-9 w-full min-w-0 rounded-md border border-border bg-surface-raised px-2 text-xs text-fg hover:border-border-strong focus:bg-surface disabled:opacity-60'

/**
 * The in-call HUD.
 *
 * Everything a rep touches while a customer is talking, in one column 380px
 * wide: what to say next, what to say when they push back, and the two things
 * that end a call well — a seat token and a locked callback. Nothing here sends
 * anything: Insert fills the WhatsApp composer and stops.
 *
 * The ordering is the argument. Course and dialect first, because they change
 * the numbers in every line below them. Then the roadmap, because that is the
 * call. Then objections, because those interrupt the call. Then the close.
 */
export function CallHud({
  identity, lead, library, calls, callSessionId, ratingOpen, onResult, onLockCallback, busy = false, layout,
}: Props) {
  const wide = (layout ?? (isWideSurface() ? 'wide' : 'column')) === 'wide'
  const [courseId, setCourseId] = useState<string | null>(null)
  const [lang, setLang] = useState(DEFAULT_LANG)
  const [useMine, setUseMine] = useState(false)
  const [showRoadmap, setShowRoadmap] = useState(true)
  const [tabOffered, setTabOffered] = useState(false)
  const [step, setStep] = useState(0)
  const [hook, setHook] = useState<HookKey>(() => hookVariant(lead, calls))
  const [objection, setObjection] = useState<Rebuttal | null>(null)
  const [sheet, setSheet] = useState<Rebuttal | null>(null)
  const [usages, setUsages] = useState<UsageRecord[]>([])
  const [snippets, setSnippets] = useState<SavedSnippet[]>([])
  const [tokenOpen, setTokenOpen] = useState(false)
  const [tokenDone, setTokenDone] = useState(false)
  const [callbackAt, setCallbackAt] = useState<{ date: string; time: string } | null>(null)
  const usageIds = useRef(new Map<string, string>())

  const courses = useMemo(() => library.courses.filter((item) => item.active), [library.courses])
  const course = useMemo(() => courses.find((item) => item.id === courseId) ?? null, [courses, courseId])

  // Dialects the workspace allows AND the library actually has, plus the
  // default — offering "Hindi" when no script has Hindi is offering a blank.
  const langs = useMemo(() => {
    const found = new Set<string>()
    for (const script of library.scripts) for (const code of script.langs) found.add(code)
    const allowed = library.config?.languages
    const base = library.config?.default_lang ?? DEFAULT_LANG
    const list = [...found].filter((code) => !allowed?.length || allowed.includes(code))
    if (!list.includes(base)) list.unshift(base)
    return list
  }, [library.config, library.scripts])

  const mySpins = useMemo(() => new Set(library.spins.map((spin) => spin.script_id)), [library.spins])
  const spinsByScript = useMemo(
    () => (scriptId: string | null): ReadonlyMap<string, PersonalSpin> => spinsFor(library.spins, scriptId),
    [library.spins],
  )

  useEffect(() => {
    let alive = true
    void Promise.all([loadPrefs(), loadSnippets()]).then(([prefs, saved]) => {
      if (!alive) return
      setUseMine(prefs.useMine)
      setShowRoadmap(prefs.showRoadmap)
      setTabOffered(prefs.openCallsInTab)
      setSnippets(saved)
      if (prefs.defaultLang) setLang(prefs.defaultLang)
      else if (library.config?.default_lang) setLang(library.config.default_lang)
      const remembered = prefs.courseByLead[lead.lead_id]
      setCourseId(remembered ?? (courses.length === 1 ? courses[0]!.id : null))
      // Progress belongs to ONE lead. A different lead starts at step 0 even if
      // the panel never unmounted — mid-call, resuming somebody else's step 3 is
      // worse than starting over.
      setStep(prefs.roadmap?.leadId === lead.lead_id ? prefs.roadmap.step : 0)
    })
    return () => { alive = false }
  }, [courses, lead.lead_id, library.config?.default_lang])

  // Lead change: the call is a different call. Nothing carries over.
  useEffect(() => {
    setObjection(null)
    setSheet(null)
    setUsages([])
    setTokenOpen(false)
    setTokenDone(false)
    setCallbackAt(null)
    usageIds.current = new Map()
    setHook(hookVariant(lead, calls))
    // `calls` is refetched per lead; recomputing on its identity would reset the
    // rep's own override every time that read settled.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.lead_id])

  const steps = useMemo(() => buildRoadmap(library.scripts, hook), [hook, library.scripts])
  const objections = useMemo(() => objectionScripts(library.scripts), [library.scripts])

  // Mid-call the rep has a phone in one hand. Hunting a chip with the mouse is
  // what costs the moment, so 1-9 fire the objections in the order they render.
  // Guarded on the event target: a rep typing "2 seats" into the token amount
  // must not have that keystroke swallowed and fire objection two instead.
  useEffect(() => {
    if (!wide) return
    function onKey(event: KeyboardEvent) {
      if (event.altKey || event.ctrlKey || event.metaKey) return
      const target = event.target as HTMLElement | null
      if (target?.isContentEditable) return
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      const index = Number(event.key) - 1
      if (!Number.isInteger(index) || index < 0 || index >= objections.length) return
      event.preventDefault()
      const script = objections[index]
      setObjection((current) => (current?.taxonomy_id === script.taxonomy_id ? null : script))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [objections, wide])
  const tokenScript = useMemo(() => composedScript(library.scripts, COMPOSED_KEYS.tokenRequest), [library.scripts])
  const callbackScript = useMemo(() => composedScript(library.scripts, COMPOSED_KEYS.callbackConfirm), [library.scripts])

  const vars = useMemo(() => ({
    name: lead.display_name,
    rep: identity.displayName,
    'client.name': identity.clientName,
    ...courseVars(course),
    ...payVars(library.config, course),
  }), [course, identity.clientName, identity.displayName, lead.display_name, library.config])

  const activeStep: RoadmapStep | null = steps[Math.min(step, Math.max(steps.length - 1, 0))] ?? null
  const activePicked = activeStep
    ? pickScript(activeStep.script, lang, useMine, spinsByScript(activeStep.script.script_id))
    : null
  const objectionPicked = objection ? pickScript(objection, lang, useMine, spinsByScript(objection.script_id)) : null
  const visibleText = toText((objectionPicked ?? activePicked)?.paragraphs ?? [])
  const courseMissing = !course && needsCourse(visibleText)
  const amount = tokenAmount(library.config, course)
  const collectable = canCollect(library.config)
  const unrated = usages.filter((usage) => usage.feedback === null)

  /**
   * One usage row per (call session, script) — a rep who taps Insert twice
   * because WhatsApp did not visibly change has used the script once. The same
   * client-minted id is reused, so the second enqueue is dropped while pending
   * and collides on the primary key if the first already landed.
   */
  async function recordUsage(script: Rebuttal, picked: PickedScript) {
    if (!script.script_version_id) return
    const sessionKey = callSessionId ?? lead.lead_id
    const dedupe = `${sessionKey}|${script.script_version_id}`
    const existing = usageIds.current.get(dedupe)
    const usageId = existing ?? crypto.randomUUID()
    usageIds.current.set(dedupe, usageId)
    await queueWrite('script_used', {
      client_id: identity.clientId,
      script_version_id: script.script_version_id,
      actor_id: identity.userId,
      call_session_id: callSessionId,
      lang: picked.lang,
      used_personal: picked.personal,
    }, new Date(), usageId)
    if (!existing) {
      setUsages((list) => [...list, { usageId, versionId: script.script_version_id!, label: script.label, feedback: null }])
    }
  }

  async function insertScript(script: Rebuttal, picked: PickedScript) {
    onResult(await insertWithFallback(renderSnippet(toText(picked.paragraphs), vars)))
    await recordUsage(script, picked)
  }

  async function rate(usage: UsageRecord, feedback: 'worked' | 'didnt_work') {
    setUsages((list) => list.map((item) => (item.usageId === usage.usageId ? { ...item, feedback } : item)))
    await queueWrite('script_feedback', { client_id: identity.clientId, usage_id: usage.usageId, feedback })
  }

  async function flagGap(script: Rebuttal, words: string) {
    await queueWrite('playbook_gap', {
      client_id: identity.clientId,
      taxonomy_id: script.taxonomy_id,
      script_version_id: script.script_version_id,
      exact_customer_words: words,
      created_by: identity.userId,
    })
    onResult('Noted — your manager will see what they said.')
  }

  function selectStep(next: number) {
    const clamped = Math.min(Math.max(next, 0), Math.max(steps.length - 1, 0))
    setStep(clamped)
    setObjection(null)
    void rememberStage(lead.lead_id, clamped)
  }

  async function saveSpin(target: Rebuttal, spinLang: string, body: string) {
    if (!target.script_id) {
      onResult('This one has no company script yet, so there is nothing to spin.')
      return
    }
    await queueWrite('save_spin', {
      client_id: identity.clientId,
      script_id: target.script_id,
      lang: spinLang,
      title: target.label,
      body,
      created_by: identity.userId,
    })
    onResult('Saved your version.')
  }

  async function resetSpin(target: Rebuttal, spinLang: string) {
    if (!target.script_id) return
    await queueWrite('delete_spin', {
      client_id: identity.clientId,
      script_id: target.script_id,
      lang: spinLang,
      created_by: identity.userId,
    })
    onResult('Back to the company standard.')
  }

  async function insertToken() {
    setTokenOpen(true)
    if (!tokenScript) {
      onResult('No seat-link text set up yet. Ask your manager to add one in Sales Hub.')
      return
    }
    const picked = pickScript(tokenScript, lang, useMine, spinsByScript(tokenScript.script_id))
    await insertScript(tokenScript, picked)
  }

  async function confirmToken() {
    setTokenDone(true)
    await queueWrite('token_received', {
      client_id: identity.clientId,
      lead_id: lead.lead_id,
      actor_id: identity.userId,
      amount,
      at: new Date().toISOString(),
    })
    onResult('Token logged on the timeline.')
  }

  async function lockCallback() {
    if (!callbackAt?.date || !callbackAt.time) return
    // Read in the client's clock, not the laptop's — see zonedIso.
    const iso = zonedIso(callbackAt.date, callbackAt.time, identity.timezone)
    if (!iso) return
    const ok = await onLockCallback(iso)
    if (!ok) return
    const when = callbackWhen(iso, identity.timezone)
    // Never insert a text with a blank in it: no readable time, no message.
    if (!when || !callbackScript) {
      setCallbackAt(null)
      return
    }
    const picked = pickScript(callbackScript, lang, useMine, spinsByScript(callbackScript.script_id))
    onResult(await insertWithFallback(renderSnippet(toText(picked.paragraphs), { ...vars, 'callback.when': when })))
    await recordUsage(callbackScript, picked)
    setCallbackAt(null)
  }

  return (
    <section
      aria-label="In-call scripts"
      data-testid="call-hud"
      data-layout={wide ? 'wide' : 'column'}
      className={[
        'min-w-0 space-y-2 overflow-hidden rounded-lg border border-border bg-surface',
        wide ? 'mx-auto w-full max-w-[1400px] p-4' : 'p-2.5',
      ].join(' ')}
    >
      {/* Row A — the course. Every number below comes from it. */}
      <div className="flex min-w-0 items-center gap-1.5">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Course</span>
          <select
            value={courseId ?? ''}
            disabled={busy}
            aria-label="Course"
            className={selectClass}
            onChange={(event) => {
              const next = event.target.value || null
              setCourseId(next)
              void rememberCourse(lead.lead_id, next)
            }}
          >
            <option value="">Pick a course</option>
            {courses.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </label>
      </div>
      {courseMissing && (
        <p role="status" className="flex min-w-0 items-center gap-1.5 rounded-md bg-warn-subtle px-2 py-1 text-2xs text-warn">
          <TriangleAlert aria-hidden size={12} strokeWidth={2} className="shrink-0" />
          Pick a course to fill numbers
        </p>
      )}

      {/* Row B — dialect, and whose words. */}
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        {langs.map((code) => (
          <button
            key={code}
            type="button"
            aria-pressed={code === lang}
            disabled={busy}
            onClick={() => setLang(code)}
            className={[
              'min-h-8 rounded-pill border px-2.5 text-2xs font-semibold uppercase transition-colors',
              code === lang
                ? 'border-accent bg-accent-subtle text-accent'
                : 'border-border bg-surface-raised text-fg-muted hover:border-border-strong hover:text-fg',
            ].join(' ')}
          >
            {code.toUpperCase()}
          </button>
        ))}
        {!wide && tabOffered && (
          <button
            type="button"
            onClick={() => void openCallTab().catch(() => onResult('Could not open the call tab.'))}
            className="shrink-0 rounded-md border border-border bg-surface-raised px-2 py-1 text-xs font-medium text-fg-muted hover:border-border-strong hover:text-fg"
          >
            Open in tab
          </button>
        )}
        <div className="ml-auto flex shrink-0 overflow-hidden rounded-md border border-border" role="group" aria-label="Wording">
          <button
            type="button"
            aria-pressed={!useMine}
            onClick={() => setUseMine(false)}
            className={['min-h-8 px-2 text-2xs font-semibold', !useMine ? 'bg-accent-subtle text-accent' : 'text-fg-muted hover:text-fg'].join(' ')}
          >
            Std
          </button>
          <button
            type="button"
            aria-pressed={useMine}
            disabled={mySpins.size === 0}
            title={mySpins.size === 0 ? 'Save a version of a script first — open one and write your spin.' : undefined}
            onClick={() => setUseMine(true)}
            className={['min-h-8 border-l border-border px-2 text-2xs font-semibold disabled:opacity-40', useMine ? 'bg-accent-subtle text-accent' : 'text-fg-muted hover:text-fg'].join(' ')}
          >
            Mine
          </button>
        </div>
      </div>

      {/* The body: the roadmap, or the objection that interrupted it.
          In the panel those are mutually exclusive — 380px cannot hold both.
          In the tab they sit side by side, because losing your place in the
          call every time a customer pushes back is the whole complaint. */}
      <div className={wide ? 'grid min-w-0 grid-cols-[2fr_1fr] items-start gap-3' : 'space-y-2'}>
        <div className="min-w-0 space-y-2">
          {objection && objectionPicked ? (
            <RebuttalCard
              script={objection}
              picked={objectionPicked}
              vars={vars}
              backLabel={activeStep?.script.label ?? 'the call'}
              busy={busy}
              rated={usages.find((u) => u.versionId === objection.script_version_id)?.feedback ?? null}
              canRate={usages.some((u) => u.versionId === objection.script_version_id)}
              onBack={() => setObjection(null)}
              onExpand={() => setSheet(objection)}
              onInsert={() => void insertScript(objection, objectionPicked)}
              onFeedback={(feedback, words) => {
                const usage = usages.find((u) => u.versionId === objection.script_version_id)
                if (usage) void rate(usage, feedback)
                if (words) void flagGap(objection, words)
              }}
            />
          ) : null}
          {(wide || !objection) && showRoadmap ? (
            <RoadmapStage
              steps={steps}
              active={step}
              lang={lang}
              useMine={useMine}
              hook={hook}
              vars={vars}
              busy={busy}
              spinsByScript={spinsByScript}
              onSelect={selectStep}
              onHook={setHook}
              onExpand={(target) => setSheet(target.script)}
              onInsert={(target) => {
                const picked = pickScript(target.script, lang, useMine, spinsByScript(target.script.script_id))
                void insertScript(target.script, picked)
              }}
            />
          ) : null}
        </div>
        <div className="min-w-0" data-testid="call-hud-objections">
          <ObjectionChips
            scripts={objections}
            activeKey={objection?.taxonomy_key ?? null}
            onPick={(script) => setObjection((current) => (current?.taxonomy_id === script.taxonomy_id ? null : script))}
          />
        </div>
      </div>

      {/* Close row. Half-width each, because they are the two ways a call ends. */}
      <div className="flex min-w-0 gap-1.5">
        <Button
          variant="secondary"
          className="min-h-11 min-w-0 flex-1 px-2 text-xs"
          disabled={busy || !collectable}
          title={collectable ? undefined : 'Ask your manager to set UPI in Sales Hub → Playbook → Settings'}
          onClick={() => void insertToken()}
        >
          <CreditCard aria-hidden size={14} strokeWidth={1.9} className="shrink-0" />
          <span className="truncate">{amount ? `₹${amount.toLocaleString('en-IN')} seat link` : 'Seat link'}</span>
        </Button>
        <Button
          variant="secondary"
          className="min-h-11 min-w-0 flex-1 px-2 text-xs"
          disabled={busy}
          aria-expanded={callbackAt !== null}
          onClick={() => setCallbackAt((current) => (current ? null : { date: '', time: '' }))}
        >
          <CalendarClock aria-hidden size={14} strokeWidth={1.9} className="shrink-0" />
          <span className="truncate">Lock callback</span>
        </Button>
      </div>
      {!collectable && (
        <p className="text-2xs text-fg-subtle">Ask your manager to set UPI in Sales Hub → Playbook → Settings.</p>
      )}

      {tokenOpen && collectable && (
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {library.config?.upi_vpa && (
            <Button
              variant="ghost"
              size="sm"
              className="min-h-11"
              onClick={() => {
                const intent = buildUpiIntent(library.config, amount, library.config?.token_note ?? 'Seat token')
                if (intent) window.open(intent, '_blank')
              }}
            >
              Open in UPI app
            </Button>
          )}
          {tokenDone ? (
            <span className="inline-flex min-h-8 items-center rounded-pill border border-[color-mix(in_srgb,var(--success)_20%,transparent)] bg-success-subtle px-2.5 text-2xs font-semibold text-success">
              Token logged
            </span>
          ) : (
            <Button variant="secondary" size="sm" className="min-h-11" disabled={busy} onClick={() => void confirmToken()}>
              ✓ Token received
            </Button>
          )}
        </div>
      )}

      {/* A callback with no time is not a callback. The button stays off until
          the rep gives one, so the confirmation never goes out with a blank. */}
      {callbackAt && (
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <input
            type="date"
            value={callbackAt.date}
            aria-label="Callback date"
            className={[selectClass, 'tnum flex-1'].join(' ')}
            onChange={(event) => setCallbackAt((current) => ({ ...current!, date: event.target.value }))}
          />
          <input
            type="time"
            value={callbackAt.time}
            aria-label="Callback time"
            className={[selectClass, 'tnum flex-1'].join(' ')}
            onChange={(event) => setCallbackAt((current) => ({ ...current!, time: event.target.value }))}
          />
          <Button
            variant="primary"
            size="sm"
            className="min-h-11"
            disabled={busy || !callbackAt.date || !callbackAt.time}
            onClick={() => void lockCallback()}
          >
            Lock
          </Button>
        </div>
      )}

      {/* After the outcome: rate what was actually said. Rated rows leave the
          strip for good — a prompt that comes back is a prompt reps learn to
          ignore. */}
      {ratingOpen && unrated.length > 0 && (
        <div role="group" aria-label="Rate the scripts you used" className="min-w-0 space-y-1 rounded-md border border-border bg-surface-sunk p-2">
          <p className="text-2xs font-semibold text-fg-muted">
            {unrated.length} {unrated.length === 1 ? 'script' : 'scripts'} used this call, rate them
          </p>
          {unrated.map((usage) => (
            <div key={usage.usageId} className="flex min-w-0 items-center gap-1.5">
              <span className="min-w-0 flex-1 truncate text-xs text-fg-muted">{usage.label}</span>
              <button
                type="button"
                aria-label={`${usage.label} worked`}
                onClick={() => void rate(usage, 'worked')}
                className="min-h-9 rounded-md border border-border bg-surface-raised px-2 text-xs hover:border-success hover:text-success"
              >
                👍
              </button>
              <button
                type="button"
                aria-label={`${usage.label} missed`}
                onClick={() => void rate(usage, 'didnt_work')}
                className="min-h-9 rounded-md border border-border bg-surface-raised px-2 text-xs hover:border-danger hover:text-danger"
              >
                👎
              </button>
            </div>
          ))}
        </div>
      )}

      {/* The rep's own saved snippets, which used to be their own bar. */}
      {snippets.length > 0 && (
        <details className="group min-w-0 overflow-hidden rounded-md border border-border">
          <summary className="flex min-h-9 cursor-pointer list-none items-center gap-1.5 px-2 select-none hover:bg-surface-sunk [&::-webkit-details-marker]:hidden">
            <Quote aria-hidden size={12} strokeWidth={1.9} className="shrink-0 text-fg-subtle" />
            <span className="label-caps">My snippets</span>
            <span className="ml-auto text-2xs text-fg-subtle tnum">{snippets.length}</span>
          </summary>
          <ul className="border-t border-border">
            {snippets.map((snippet) => (
              <li key={snippet.id}>
                <button
                  type="button"
                  className="flex min-h-11 w-full min-w-0 flex-col items-start gap-0.5 border-b border-border px-2 py-1.5 text-left last:border-b-0 hover:bg-surface-sunk"
                  onClick={() => void insertWithFallback(renderSnippet(snippet.body, vars)).then(onResult)}
                >
                  <span className="w-full truncate text-xs font-medium text-fg">{snippet.title}</span>
                  <span className="line-clamp-1 w-full text-2xs text-fg-subtle">{renderSnippet(snippet.body, vars)}</span>
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      {sheet && (
        <ScriptSheet
          script={sheet}
          onClose={() => setSheet(null)}
          langs={langs}
          lang={lang}
          onLang={(code) => { setLang(code); void savePrefs({ defaultLang: code }) }}
          vars={vars}
          spins={spinsByScript(sheet.script_id)}
          canEditStandard={identity.role === 'manager' || identity.role === 'client_admin'}
          busy={busy}
          onSaveSpin={(spinLang, body) => void saveSpin(sheet, spinLang, body)}
          onResetSpin={(spinLang) => void resetSpin(sheet, spinLang)}
          onInsert={(text) => void insertWithFallback(renderSnippet(text, vars)).then(onResult)}
        />
      )}
    </section>
  )
}
