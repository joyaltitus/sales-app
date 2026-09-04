import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, ChevronsUp, Pause, Play, Save, TriangleAlert } from 'lucide-react'
import { Button } from '../../ui/Button'
import { EmptyState } from '../../ui/EmptyState'
import { ErrorState } from '../../ui/ErrorState'
import { Skeleton } from '../../ui/Skeleton'
import { useClient } from '../../shell/ClientProvider'
import { useAuth } from '../../auth/AuthProvider'
import { createDraftVersion, ensureScript, promoteScriptVersion, useScriptLibrary, useWinRates } from '../../lib/scripts-data'
import type { LibraryScript, WinRate } from '../../lib/scripts-data'
import { buildMergeVars, variantLangs } from '../../lib/script-body'
import { closeGap, useCourses, useSalesConfig, useTeardown, weekStart } from '../../lib/sales-settings-data'
import type { TeardownGap } from '../../lib/sales-settings-data'
import { BASE_LANG, DialectEditor, bodyFromDrafts, draftsFromBody } from '../docs/playbook/DialectEditor'
import type { Drafts } from '../docs/playbook/DialectEditor'
import { MOVED_ON_NOTICE, WinRateChip, formatDate, isConcurrencyError, winRateLabel } from '../docs/playbook/shared'

// The weekly teardown: fifteen minutes, four panels, one fix. What the floor
// heard, what the scripts did about it, where there was nothing to say, and the
// editor to fix the worst one — in the meeting, not after it.

const MEETING_SECONDS = 15 * 60

function Countdown() {
  const [left, setLeft] = useState(MEETING_SECONDS)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setLeft((s) => (s <= 0 ? 0 : s - 1)), 1000)
    return () => clearInterval(id)
  }, [running])

  const mm = String(Math.floor(left / 60)).padStart(2, '0')
  const ss = String(left % 60).padStart(2, '0')
  return (
    <div className="flex items-center gap-2">
      <span
        className={['tnum text-lg font-semibold', left === 0 ? 'text-warn' : 'text-fg'].join(' ')}
        style={{ fontFamily: 'var(--font-mono)' }}
        role="timer"
        aria-label={`${mm} minutes ${ss} seconds left`}
      >
        {mm}:{ss}
      </span>
      <Button variant="secondary" size="sm" onClick={() => setRunning((r) => !r)}>
        {running ? <Pause aria-hidden size={13} /> : <Play aria-hidden size={13} />}
        {running ? 'Pause' : 'Start'}
      </Button>
    </div>
  )
}

function Card({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4 shadow-elev-1">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-fg">{title}</h3>
        {note && <p className="text-2xs text-fg-muted">{note}</p>}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  )
}

/** Panel 4. Kept in its own component so its draft state resets cleanly
 *  whenever the manager picks a different script to fix. */
function FixBox({
  clientId,
  actorId,
  script,
  offered,
  courseName,
  vars,
  gap,
  onDone,
}: {
  clientId: string | null
  actorId: string | null
  script: LibraryScript
  offered: string[]
  courseName: string | null
  vars: Record<string, unknown>
  gap: TeardownGap | null
  onDone: () => void
}) {
  const [drafts, setDrafts] = useState<Drafts>(() => draftsFromBody(script.current?.body))
  const [lang, setLang] = useState(BASE_LANG)
  const [note, setNote] = useState(gap?.words ? `Customer said: “${gap.words}”` : '')
  const [busy, setBusy] = useState<'save' | 'promote' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<{ id: string; version: number } | null>(null)

  const tabs = useMemo(
    () => [...new Set([BASE_LANG, ...offered, ...variantLangs(script.current?.body)])],
    [offered, script],
  )

  const saveDraft = async (): Promise<{ id: string; version: number } | null> => {
    if (!clientId || !actorId) return null
    setBusy('save')
    setError(null)
    let scriptId = script.scriptId
    if (!scriptId) {
      const created = await ensureScript(clientId, script.taxonomyId, actorId)
      if (!created.ok) {
        setBusy(null)
        setError(created.message)
        return null
      }
      scriptId = created.id
    }
    const result = await createDraftVersion({
      clientId,
      scriptId,
      headline: script.current?.headline ?? script.taxonomyLabel,
      body: bodyFromDrafts(drafts),
      changeNote: note.trim() || null,
      createdBy: actorId,
    })
    setBusy(null)
    if (!result.ok) {
      setError(result.message)
      return null
    }
    setSaved({ id: result.id, version: result.version })
    onDone()
    return { id: result.id, version: result.version }
  }

  const promote = async () => {
    if (!script.scriptId && !saved) {
      const draft = await saveDraft()
      if (!draft) return
    }
    const target = saved ?? (await saveDraft())
    if (!target || !script.scriptId) return
    setBusy('promote')
    setError(null)
    const standard = script.versions.find((v) => v.status === 'standard') ?? null
    const result = await promoteScriptVersion(script.scriptId, target.id, standard?.id ?? null)
    if (!result.ok) {
      setBusy(null)
      setError(isConcurrencyError(result.message) ? MOVED_ON_NOTICE : result.message)
      return
    }
    // Promoting the rebuttal is what closes the gap — the gap existed because
    // there was nothing to say, and now there is.
    if (gap && clientId) {
      const closed = await closeGap(clientId, gap.id)
      if (!closed.ok) setError(closed.message)
    }
    setBusy(null)
    onDone()
  }

  return (
    <Card title={`Fix: ${script.taxonomyLabel}`} note={gap ? 'From a flagged gap' : undefined}>
      {error && (
        <p role="alert" className="mb-3 rounded-md bg-danger-subtle px-3 py-2 text-xs text-danger">
          {error}
        </p>
      )}
      <DialectEditor
        drafts={drafts}
        setDrafts={setDrafts}
        lang={lang}
        setLang={setLang}
        tabs={tabs}
        offered={offered}
        vars={vars}
        courseName={courseName}
        compact
      />
      <label className="mt-3 block text-xs font-semibold text-fg">
        Why this changed
        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="What the customer actually said"
          className="mt-1.5 h-9 w-full rounded-md border border-border bg-surface-sunk px-3 text-sm text-fg placeholder:text-fg-subtle"
        />
      </label>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" onClick={() => void saveDraft()} disabled={busy !== null}>
          <Save aria-hidden size={13} /> {busy === 'save' ? 'Saving…' : 'Save draft'}
        </Button>
        <Button size="sm" onClick={() => void promote()} disabled={busy !== null}>
          <ChevronsUp aria-hidden size={13} /> {busy === 'promote' ? 'Promoting…' : 'Promote'}
        </Button>
        {saved && (
          <span className="text-2xs text-success" role="status">
            Saved as v{saved.version}
          </span>
        )}
      </div>
    </Card>
  )
}

export function Teardown() {
  const { activeClient } = useClient()
  const { session } = useAuth()
  const clientId = activeClient?.id ?? null
  const actorId = session?.user.id ?? null
  const canManage =
    activeClient?.role === 'manager' || activeClient?.role === 'client_admin' || activeClient?.role === 'super_admin'

  const [start, setStart] = useState(() => weekStart(new Date()))
  const teardown = useTeardown(clientId, start)
  const library = useScriptLibrary(clientId)
  const winRates = useWinRates(clientId)
  const config = useSalesConfig(clientId)
  const courses = useCourses(clientId)
  const [fixing, setFixing] = useState<{ script: LibraryScript; gap: TeardownGap | null } | null>(null)

  const course = courses.courses[0] ?? null
  const vars = useMemo(
    () =>
      buildMergeVars({
        clientName: activeClient?.name ?? null,
        course: course ? { name: course.name, facts: course.facts } : null,
        salesConfig: {
          tokenAmount: config.config.tokenAmount,
          payUrl: config.config.payUrl,
          upiVpa: config.config.upiVpa,
        },
      }),
    [course, config.config, activeClient],
  )

  const ranked = useMemo(() => {
    return library.scripts
      .filter((s) => s.taxonomyStatus === 'active' && s.current?.status === 'standard')
      .map((s) => ({ script: s, rate: winRates.rates.get(s.current!.id) as WinRate | undefined }))
      .sort((a, b) => {
        const score = (r: WinRate | undefined) => (r && r.rated > 0 ? r.won / r.rated : -1)
        return score(b.rate) - score(a.rate)
      })
  }, [library.scripts, winRates.rates])

  // A rep never routes to ManagerShell, so this is defence in depth rather than
  // the only wall — and it says the same thing the rest of the app says.
  if (!canManage) {
    return (
      <div className="page-frame">
        <ErrorState
          title="Managers only"
          body="The weekly teardown reviews the whole floor's objections. Ask an admin if you need access."
        />
      </div>
    )
  }

  const maxCount = Math.max(1, ...teardown.objections.map((o) => o.count))
  const shiftWeek = (weeks: number) => {
    const next = new Date(start)
    next.setDate(next.getDate() + weeks * 7)
    setStart(weekStart(next))
  }
  const weekLabel = `${formatDate(start.toISOString())} → ${formatDate(new Date(start.getTime() + 6 * 864e5).toISOString())}`

  return (
    <div className="page-frame max-w-[1500px] space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.04em] text-fg">Weekly teardown</h1>
          <p className="mt-1 text-sm text-fg-muted">Review this week’s objections and update the company response.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-md border border-border bg-surface p-0.5">
            <button
              onClick={() => shiftWeek(-1)}
              aria-label="Previous week"
              className="rounded-sm p-1.5 text-fg-muted hover:bg-surface-sunk hover:text-fg"
            >
              <ChevronLeft aria-hidden size={15} />
            </button>
            <span className="tnum px-2 text-xs font-semibold text-fg">{weekLabel}</span>
            <button
              onClick={() => shiftWeek(1)}
              aria-label="Next week"
              className="rounded-sm p-1.5 text-fg-muted hover:bg-surface-sunk hover:text-fg"
            >
              <ChevronRight aria-hidden size={15} />
            </button>
          </div>
          <Countdown />
        </div>
      </header>

      {teardown.error && <ErrorState title="Couldn't load the week" body={teardown.error} onRetry={teardown.reload} />}

      <div className="grid gap-3 lg:grid-cols-2">
        <Card title="What they said" note="This week, by tag">
          {teardown.loading ? (
            <Skeleton className="h-32" />
          ) : teardown.objections.length ? (
            <div className="space-y-2.5">
              {teardown.objections.map((o) => (
                <div key={o.taxonomyId} className="flex items-center gap-2 text-xs">
                  <span className="w-28 shrink-0 truncate text-fg-muted">{o.label}</span>
                  <span
                    className="h-3 rounded-[3px] bg-chart-ink"
                    style={{ width: `${Math.max(4, (o.count / maxCount) * 65)}%` }}
                  />
                  <span className="tnum text-fg">{o.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-fg-muted">Nothing logged this week.</p>
          )}
        </Card>

        <Card title="What the scripts did" note="Standards by win rate">
          {ranked.length ? (
            <div className="space-y-2">
              {ranked.slice(0, 8).map(({ script, rate }) => (
                <div key={script.taxonomyId} className="flex items-center gap-2 border-b border-border pb-2 text-xs last:border-0 last:pb-0">
                  <span className="min-w-0 flex-1 truncate text-fg">{script.taxonomyLabel}</span>
                  <WinRateChip rate={rate} />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 shrink-0 px-2 text-2xs"
                    onClick={() => setFixing({ script, gap: null })}
                  >
                    Fix
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-fg-muted">No standard scripts yet.</p>
          )}
        </Card>
      </div>

      <Card title="Nothing to say" note="Open gaps a rep flagged">
        {teardown.gaps.length ? (
          <div className="space-y-2">
            {teardown.gaps.map((gap) => {
              const script = library.scripts.find((s) => s.taxonomyId === gap.taxonomyId) ?? null
              return (
                <div
                  key={gap.id}
                  className="flex flex-wrap items-start gap-2 border-b border-border pb-2 last:border-0 last:pb-0"
                >
                  <TriangleAlert aria-hidden size={14} className="mt-0.5 shrink-0 text-warn" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-fg">{gap.words ? `“${gap.words}”` : 'No words captured'}</p>
                    <p className="mt-0.5 text-2xs text-fg-subtle">
                      {gap.label} · {gap.authorName ?? 'Unknown'} · {formatDate(gap.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-7 px-2 text-2xs"
                      disabled={!script}
                      onClick={() => script && setFixing({ script, gap })}
                    >
                      Draft rebuttal
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-2xs"
                      onClick={() => void (clientId && closeGap(clientId, gap.id).then(teardown.reload))}
                    >
                      Close gap
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <EmptyState title="No open gaps." body="Every objection the floor met this week had something to say back." />
        )}
      </Card>

      {fixing ? (
        <FixBox
          key={`${fixing.script.taxonomyId}-${fixing.gap?.id ?? 'none'}`}
          clientId={clientId}
          actorId={actorId}
          script={fixing.script}
          offered={config.config.languages}
          courseName={course?.name ?? null}
          vars={vars}
          gap={fixing.gap}
          onDone={() => {
            void library.reload()
            void winRates.reload()
            void teardown.reload()
          }}
        />
      ) : (
        <Card title="Fix one thing" note="Pick a script above">
          <p className="text-xs text-fg-muted">
            {ranked.length
              ? `Lowest win rate right now: ${ranked[ranked.length - 1].script.taxonomyLabel} (${winRateLabel(ranked[ranked.length - 1].rate).text}).`
              : 'Promote a script first and its win rate shows up here.'}
          </p>
        </Card>
      )}
    </div>
  )
}
