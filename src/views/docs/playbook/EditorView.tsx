import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronsUp, History } from 'lucide-react'
import { Button } from '../../../ui/Button'
import { Chip } from '../../../ui/Chip'
import { ErrorState } from '../../../ui/ErrorState'
import { Sheet } from '../../../ui/Sheet'
import { createDraftVersion, ensureScript, promoteScriptVersion } from '../../../lib/scripts-data'
import type { LibraryScript } from '../../../lib/scripts-data'
import { buildMergeVars, variantLangs } from '../../../lib/script-body'
import type { Course } from '../../../lib/sales-settings-data'
import { BASE_LANG, DialectEditor, bodyFromDrafts, draftsFromBody } from './DialectEditor'
import type { Drafts } from './DialectEditor'
import { MOVED_ON_NOTICE, STATUS_TONE, ScriptText, formatDate, isConcurrencyError } from './shared'

// Manager chrome around DialectEditor: which script, autosave, version history
// and the promote transition. ONE version row carries every dialect (068), which
// is what keeps "the standard" a single promotable thing rather than one version
// per language quietly drifting apart.

const AUTOSAVE_MS = 1400

export function EditorView({
  clientId,
  actorId,
  script,
  allScripts,
  offered,
  course,
  clientName,
  onSelectTaxonomy,
  onLibraryChange,
}: {
  clientId: string | null
  actorId: string | null
  script: LibraryScript
  allScripts: LibraryScript[]
  offered: string[]
  course: Course | null
  clientName: string | null
  onSelectTaxonomy?: (taxonomyId: string) => void
  onLibraryChange: () => void
}) {
  const [drafts, setDrafts] = useState<Drafts>(() => draftsFromBody(script.current?.body))
  const [extraLangs, setExtraLangs] = useState<string[]>([])
  const [lang, setLang] = useState(BASE_LANG)
  const lastSavedRef = useRef(JSON.stringify(bodyFromDrafts(draftsFromBody(script.current?.body))))

  const [pendingDraft, setPendingDraft] = useState<{ id: string; version: number } | null>(null)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null)
  const [promoteOpen, setPromoteOpen] = useState(false)
  const [promoting, setPromoting] = useState(false)
  const [promoteError, setPromoteError] = useState<string | null>(null)

  // Tabs = what the tenant offers ∪ what this version already carries ∪ what the
  // manager just added. A version can carry a dialect the tenant has since
  // stopped offering; that tab still shows, greyed, so the text is never lost.
  const present = variantLangs(script.current?.body)
  const tabs = useMemo(
    () => [...new Set([BASE_LANG, ...offered, ...present, ...extraLangs])],
    [offered, present, extraLangs],
  )

  const vars = useMemo(
    () =>
      buildMergeVars({
        clientName,
        course: course ? { name: course.name, facts: course.facts } : null,
      }),
    [course, clientName],
  )

  // Autosave: one debounced insert per pause. Versions are immutable, so this
  // fires on pause-in-typing, never per keystroke.
  useEffect(() => {
    const serialised = JSON.stringify(bodyFromDrafts(drafts))
    if (serialised === lastSavedRef.current) return
    if (!clientId || !actorId) return
    setSaveState('saving')
    const timer = setTimeout(() => {
      void (async () => {
        let scriptId = script.scriptId
        if (!scriptId) {
          const created = await ensureScript(clientId, script.taxonomyId, actorId)
          if (!created.ok) {
            setSaveState('error')
            setSaveError(created.message)
            return
          }
          scriptId = created.id
        }
        const result = await createDraftVersion({
          clientId,
          scriptId,
          headline: script.current?.headline ?? script.taxonomyLabel,
          body: bodyFromDrafts(drafts),
          createdBy: actorId,
        })
        if (!result.ok) {
          setSaveState('error')
          setSaveError(result.message)
          return
        }
        lastSavedRef.current = serialised
        setPendingDraft({ id: result.id, version: result.version })
        setSaveState('saved')
        onLibraryChange()
      })()
    }, AUTOSAVE_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drafts, clientId, actorId])

  const standardVersion = script.versions.find((v) => v.status === 'standard') ?? null
  const selectedVersion = script.versions.find((v) => v.id === selectedVersionId) ?? null
  const promoteTarget =
    pendingDraft ??
    (script.current && script.current.status !== 'standard'
      ? { id: script.current.id, version: script.current.version }
      : null)

  const handlePromote = async () => {
    if (!promoteTarget || !script.scriptId) return
    setPromoting(true)
    setPromoteError(null)
    const result = await promoteScriptVersion(script.scriptId, promoteTarget.id, standardVersion?.id ?? null)
    setPromoting(false)
    if (!result.ok) {
      // A concurrency raise is never retried blind — someone else promoted
      // something and this manager has to look at it first.
      setPromoteError(isConcurrencyError(result.message) ? MOVED_ON_NOTICE : result.message)
      return
    }
    setPendingDraft(null)
    setPromoteOpen(false)
    onLibraryChange()
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[190px_minmax(0,1fr)]">
      {onSelectTaxonomy && (
        <aside aria-label="Script picker" className="rounded-xl border border-border bg-surface p-3 shadow-elev-1">
          <p className="label-caps px-2">Scripts</p>
          <div className="mt-2 space-y-1">
            {allScripts.map((item) => (
              <button
                key={item.taxonomyId}
                onClick={() => onSelectTaxonomy(item.taxonomyId)}
                className={[
                  'flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-xs font-semibold',
                  item.taxonomyId === script.taxonomyId
                    ? 'bg-accent-subtle text-accent'
                    : 'text-fg-muted hover:bg-surface-sunk hover:text-fg',
                ].join(' ')}
              >
                <span className="min-w-0 truncate">{item.taxonomyLabel}</span>
                <span className="tnum shrink-0 text-2xs">{item.current ? `v${item.current.version}` : '—'}</span>
              </button>
            ))}
          </div>
        </aside>
      )}

      <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-surface shadow-elev-2">
        <header className="flex flex-wrap items-center gap-3 border-b border-border bg-surface-raised p-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-md font-semibold text-fg">{script.taxonomyLabel}</h3>
              <Chip tone={script.current ? STATUS_TONE[script.current.status] : 'neutral'}>
                {script.current ? script.current.status : 'No script'}
              </Chip>
            </div>
            <p className="mt-1 text-2xs text-fg-muted" role="status">
              {saveState === 'saving'
                ? 'Saving draft…'
                : saveState === 'error'
                  ? `Autosave failed: ${saveError}`
                  : pendingDraft
                    ? `Saved as v${pendingDraft.version}`
                    : script.current
                      ? `Editing creates v${script.current.version + 1}`
                      : 'Editing creates v1'}
            </p>
          </div>
          <Button size="sm" onClick={() => setPromoteOpen(true)} disabled={!promoteTarget}>
            <ChevronsUp aria-hidden size={14} /> Promote
          </Button>
        </header>

        <div className="p-4">
          <DialectEditor
            drafts={drafts}
            setDrafts={setDrafts}
            lang={lang}
            setLang={setLang}
            tabs={tabs}
            offered={offered}
            vars={vars}
            courseName={course?.name ?? null}
            onAddLanguage={(code) => {
              setExtraLangs((all) => [...all, code])
              setLang(code)
            }}
          />

          <div className="mt-5 border-t border-border pt-4">
            <p className="label-caps mb-2 flex items-center gap-1">
              <History aria-hidden size={12} /> Version history
            </p>
            <div className="flex gap-2 overflow-x-auto">
              {script.versions.slice(0, 8).map((v) => (
                <button
                  key={v.id}
                  onClick={() => setSelectedVersionId(selectedVersionId === v.id ? null : v.id)}
                  aria-pressed={selectedVersionId === v.id}
                  className={[
                    'min-w-24 shrink-0 rounded-md px-2.5 py-1.5 text-left text-xs',
                    selectedVersionId === v.id
                      ? 'bg-surface-raised font-semibold text-fg shadow-elev-1'
                      : 'text-fg-muted hover:text-fg',
                  ].join(' ')}
                >
                  <span className="tnum block">Version {v.version}</span>
                  <span className="mt-0.5 block text-2xs text-fg-subtle">
                    {v.status === 'standard' ? 'Standard' : formatDate(v.createdAt)}
                  </span>
                </button>
              ))}
              {!script.versions.length && <p className="text-2xs text-fg-subtle">No versions yet.</p>}
            </div>
            {selectedVersion && (
              <div className="mt-2 max-h-48 overflow-y-auto rounded-md border border-border bg-surface-sunk p-3">
                <ScriptText paragraphs={selectedVersion.body?.paragraphs ?? []} />
              </div>
            )}
          </div>
        </div>
      </section>

      <Sheet
        open={promoteOpen}
        onClose={() => {
          setPromoteOpen(false)
          setPromoteError(null)
        }}
        title="Promote to company standard?"
      >
        {promoteError ? (
          <ErrorState title="Promotion failed" body={promoteError} onRetry={() => setPromoteError(null)} />
        ) : (
          <>
            <div className="rounded-lg border border-[color-mix(in_srgb,var(--warn)_24%,var(--border))] bg-warn-subtle p-4">
              <p className="text-sm font-semibold text-fg">Every rep will see this wording first.</p>
              <p className="mt-2 text-xs leading-relaxed text-fg-muted">
                Version {promoteTarget?.version ?? '—'} becomes the standard for {script.taxonomyLabel}, in every
                dialect it carries. The current standard stays in version history.
              </p>
            </div>
            <div className="mt-5 flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setPromoteOpen(false)} disabled={promoting}>
                Keep testing
              </Button>
              <Button className="flex-1" onClick={() => void handlePromote()} disabled={promoting || !promoteTarget}>
                <Check aria-hidden size={14} /> {promoting ? 'Promoting…' : 'Promote'}
              </Button>
            </div>
          </>
        )}
      </Sheet>
    </div>
  )
}
