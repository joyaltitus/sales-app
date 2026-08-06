import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Archive,
  ArrowRight,
  BookOpen,
  Check,
  ChevronsUp,
  GitCompareArrows,
  History,
  Library,
  Merge,
  PenLine,
  Plus,
  Search,
  Sparkles,
} from 'lucide-react'
import { Avatar } from '../../ui/Avatar'
import { Button } from '../../ui/Button'
import { Chip } from '../../ui/Chip'
import { EmptyState } from '../../ui/EmptyState'
import { ErrorState } from '../../ui/ErrorState'
import { Sheet } from '../../ui/Sheet'
import { Skeleton } from '../../ui/Skeleton'
import { SampleTag } from '../../ui/agent/primitives'
import { useClient } from '../../shell/ClientProvider'
import { useAuth } from '../../auth/AuthProvider'
import {
  archiveTaxonomy,
  createDraftVersion,
  createTaxonomy,
  ensureScript,
  promoteScriptVersion,
  renameTaxonomy,
  useScriptLibrary,
  useScriptUsageCounts,
} from '../../lib/scripts-data'
import type { LibraryScript, ScriptParagraph, ScriptStatus, TaxonomyRow } from '../../lib/scripts-data'

type PlaybookView = 'library' | 'editor' | 'taxonomy' | 'read'
type PreviewState = 'ready' | 'loading' | 'error'

const STATUS_TONE: Record<ScriptStatus, 'neutral' | 'warn' | 'success'> = {
  draft: 'neutral',
  testing: 'warn',
  standard: 'success',
}

function flattenBody(body: { paragraphs: ScriptParagraph[] } | null | undefined): string {
  return (body?.paragraphs ?? []).map((p) => `${p.before}${p.highlight ?? ''}${p.after ?? ''}`).join('\n\n')
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function LoadingGrid() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <Skeleton className="h-56" />
      <Skeleton className="h-56" />
      <Skeleton className="h-56" />
    </div>
  )
}

function ScriptCard({ script, uses, onOpen }: { script: LibraryScript; uses: number; onOpen: () => void }) {
  const version = script.current
  return (
    <button onClick={onOpen} className="group flex min-h-56 flex-col rounded-xl border border-border bg-surface p-4 text-left shadow-elev-1 transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-border-strong hover:shadow-elev-2">
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-subtle text-sm font-bold text-accent">{script.taxonomyLabel.slice(0, 1)}</span>
        <div className="flex items-center gap-1.5">
          <Chip tone={version ? STATUS_TONE[version.status] : 'neutral'}>{version ? version.status[0].toUpperCase() + version.status.slice(1) : 'No script'}</Chip>
          {version && <span className="tnum text-2xs text-fg-subtle">v{version.version}</span>}
        </div>
      </div>
      <h3 className="mt-4 text-lg font-semibold tracking-[-0.025em] text-fg">{script.taxonomyLabel}</h3>
      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-fg-muted">{version?.headline ?? 'No script authored yet — open the editor to write the first draft.'}</p>
      <div className="mt-auto pt-5">
        <div className="flex items-center justify-between border-t border-border pt-3">
          <span className="flex items-center gap-2">
            <Avatar name={version?.createdByName ?? null} size="sm" />
            <span className="text-2xs text-fg-muted">{version?.createdByName ?? 'Unassigned'}<span className="block text-fg-subtle">{formatDate(version?.createdAt)}</span></span>
          </span>
          <span className="text-right">
            <strong className="tnum block text-md text-fg">{version ? uses : '—'}</strong>
            <span className="text-2xs text-fg-subtle">{version ? 'uses' : 'not yet measured'}</span>
          </span>
        </div>
      </div>
    </button>
  )
}

function LibraryView({
  scripts,
  usageCounts,
  onEdit,
}: {
  scripts: LibraryScript[]
  usageCounts: Map<string, number>
  onEdit: (script: LibraryScript) => void
}) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<ScriptStatus | 'all'>('all')
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return scripts.filter((script) => {
      if (status !== 'all' && script.current?.status !== status) return false
      if (!q) return true
      return script.taxonomyLabel.toLowerCase().includes(q) || (script.current?.headline ?? '').toLowerCase().includes(q)
    })
  }, [scripts, query, status])

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface p-2 shadow-elev-1">
        <div className="relative min-w-52 flex-1">
          <Search aria-hidden size={14} className="absolute top-1/2 left-3 -translate-y-1/2 text-fg-subtle" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search scripts" placeholder="Search objection or phrase" className="h-10 w-full rounded-md bg-surface-sunk pr-3 pl-9 text-sm text-fg placeholder:text-fg-subtle" />
        </div>
        <div className="flex gap-1 overflow-x-auto" role="group" aria-label="Script status">
          {(['all', 'standard', 'testing', 'draft'] as const).map((item) => <button key={item} onClick={() => setStatus(item)} aria-pressed={status === item} className={['min-h-9 shrink-0 rounded-md px-3 text-xs font-semibold capitalize', status === item ? 'bg-accent-subtle text-accent' : 'text-fg-muted hover:bg-surface-sunk hover:text-fg'].join(' ')}>{item}</button>)}
        </div>
      </div>
      {visible.length ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{visible.map((script) => <ScriptCard key={script.taxonomyId} script={script} uses={script.current ? usageCounts.get(script.current.id) ?? 0 : 0} onOpen={() => onEdit(script)} />)}</div>
      ) : (
        <EmptyState icon={Search} title="No scripts match." body="Clear the search or switch the status filter. The objection taxonomy remains unchanged." />
      )}
    </div>
  )
}

function EditorView({
  clientId,
  actorId,
  script,
  allScripts,
  onSelectTaxonomy,
  onLibraryChange,
}: {
  clientId: string | null
  actorId: string | null
  script: LibraryScript
  allScripts: LibraryScript[]
  onSelectTaxonomy: (taxonomyId: string) => void
  onLibraryChange: () => void
}) {
  const [compare, setCompare] = useState(true)
  const [draftText, setDraftText] = useState(() => flattenBody(script.current?.body))
  const lastSavedRef = useRef(draftText)
  const [pendingDraft, setPendingDraft] = useState<{ id: string; version: number } | null>(null)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(script.versions[1]?.id ?? script.versions[0]?.id ?? null)
  const [promoteOpen, setPromoteOpen] = useState(false)
  const [promoting, setPromoting] = useState(false)
  const [promoteError, setPromoteError] = useState<string | null>(null)
  const [promoted, setPromoted] = useState(false)
  const [assist, setAssist] = useState<string | null>(null)

  // Autosave: a plain insert into script_versions per debounced pause, the
  // editor's sanctioned draft-creation path (no RPC for drafts, only for
  // promote). Versions are immutable once written, so this deliberately
  // fires on pause-in-typing, not per keystroke.
  useEffect(() => {
    if (draftText === lastSavedRef.current) return
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
          body: { paragraphs: [{ before: draftText }] },
          createdBy: actorId,
        })
        if (!result.ok) {
          setSaveState('error')
          setSaveError(result.message)
          return
        }
        lastSavedRef.current = draftText
        setPendingDraft({ id: result.id, version: result.version })
        setSaveState('saved')
        onLibraryChange()
      })()
    }, 1400)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftText, clientId, actorId])

  const selectedVersion = script.versions.find((v) => v.id === selectedVersionId) ?? null
  const standardVersion = script.versions.find((v) => v.status === 'standard') ?? null
  const promoteTarget = pendingDraft
    ? pendingDraft
    : script.current && script.current.status !== 'standard'
      ? { id: script.current.id, version: script.current.version }
      : null

  const handlePromote = async () => {
    if (!promoteTarget || !script.scriptId) return
    setPromoting(true)
    setPromoteError(null)
    const result = await promoteScriptVersion(script.scriptId, promoteTarget.id, standardVersion?.id ?? null)
    setPromoting(false)
    if (!result.ok) {
      setPromoteError(result.message)
      return
    }
    setPromoted(true)
    setPendingDraft(null)
    setPromoteOpen(false)
    onLibraryChange()
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[190px_minmax(0,1fr)]">
      <aside className="rounded-xl border border-border bg-surface p-3 shadow-elev-1">
        <p className="label-caps px-2">Objections</p>
        <div className="mt-2 space-y-1">{allScripts.map((item) => <button key={item.taxonomyId} onClick={() => onSelectTaxonomy(item.taxonomyId)} className={['flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-xs font-semibold', item.taxonomyId === script.taxonomyId ? 'bg-accent-subtle text-accent' : 'text-fg-muted hover:bg-surface-sunk hover:text-fg'].join(' ')}><span>{item.taxonomyLabel}</span><span className="tnum text-2xs">{item.current ? `v${item.current.version}` : '—'}</span></button>)}</div>
      </aside>

      <main className="overflow-hidden rounded-xl border border-border bg-surface shadow-elev-2">
        <header className="flex flex-wrap items-center gap-3 border-b border-border bg-surface-raised p-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-fg">{script.taxonomyLabel}</h3>
              <Chip tone={promoted || script.current?.status === 'standard' ? 'success' : script.current ? STATUS_TONE[script.current.status] : 'neutral'}>{promoted ? 'Standard' : script.current ? script.current.status : 'No script'}</Chip>
            </div>
            <p className="mt-1 text-2xs text-fg-muted">
              {saveState === 'saving' ? 'Saving draft…' : saveState === 'error' ? `Autosave failed: ${saveError}` : pendingDraft ? `Saved as v${pendingDraft.version}` : script.current ? `Editing creates v${script.current.version + 1}` : 'Editing creates v1'}
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setCompare((value) => !value)}><GitCompareArrows aria-hidden size={14} /> {compare ? 'Hide compare' : 'Compare'}</Button>
          <Button size="sm" onClick={() => setPromoteOpen(true)} disabled={!promoteTarget}><ChevronsUp aria-hidden size={14} /> Promote</Button>
        </header>

        <div className="grid min-h-[470px] xl:grid-cols-[150px_minmax(0,1fr)]">
          <aside className="border-b border-border bg-surface-sunk p-3 xl:border-r xl:border-b-0">
            <p className="label-caps flex items-center gap-1"><History aria-hidden size={12} /> Version history</p>
            <div className="mt-3 flex gap-2 overflow-x-auto xl:block xl:space-y-1">
              {script.versions.map((v) => <button key={v.id} onClick={() => setSelectedVersionId(v.id)} className={['min-w-24 rounded-md px-2.5 py-2 text-left text-xs xl:w-full', selectedVersionId === v.id ? 'bg-surface-raised font-semibold text-fg shadow-elev-1' : 'text-fg-muted hover:text-fg'].join(' ')}><span className="tnum block">Version {v.version}</span><span className="mt-0.5 block text-2xs text-fg-subtle">{v.status === 'standard' ? 'Standard' : formatDate(v.createdAt)}</span></button>)}
              {!script.versions.length && <p className="px-2.5 py-2 text-2xs text-fg-subtle">No versions yet.</p>}
            </div>
          </aside>

          <div className="p-4">
            <div className={compare ? 'grid gap-4 lg:grid-cols-2' : ''}>
              {compare && <section><div className="mb-2 flex items-center justify-between"><p className="label-caps">{selectedVersion ? `Version ${selectedVersion.version}` : 'No version'}</p><span className="text-2xs text-fg-subtle">Read only</span></div><div className="min-h-64 whitespace-pre-wrap rounded-lg border border-border bg-surface-sunk p-4 text-sm leading-7 text-fg-muted">{selectedVersion ? flattenBody(selectedVersion.body) : 'Nothing to compare yet.'}</div></section>}
              <section><div className="mb-2 flex items-center justify-between"><p className="label-caps text-accent">Draft {pendingDraft ? `v${pendingDraft.version}` : script.current ? `v${script.current.version + 1}` : 'v1'}</p><span className="text-2xs text-fg-subtle">{saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : 'Autosave'}</span></div><textarea value={draftText} onChange={(event) => setDraftText(event.target.value)} aria-label="Script draft" className="min-h-64 w-full resize-y rounded-lg border border-border bg-surface-raised p-4 text-sm leading-7 text-fg shadow-[var(--inset-highlight)]" /></section>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
              <span className="mr-1 flex items-center gap-1 text-2xs font-semibold text-fg-muted"><Sparkles aria-hidden size={13} className="text-accent" /> AI assist</span>
              <Button variant="secondary" size="sm" onClick={() => setAssist('Variant drafted beside your original. Nothing was replaced.')}>Draft a variant</Button>
              <Button variant="secondary" size="sm" onClick={() => setAssist('Suggested 18 fewer words and one clearer question.')}>Tighten this</Button>
              {assist && <span className="text-2xs text-success" role="status">{assist}</span>}
            </div>
          </div>
        </div>
      </main>

      <Sheet open={promoteOpen} onClose={() => { setPromoteOpen(false); setPromoteError(null) }} title="Promote to company standard?">
        {promoteError ? (
          <ErrorState title="Promotion failed" body={promoteError} onRetry={() => setPromoteError(null)} />
        ) : (
          <>
            <div className="rounded-lg border border-[color-mix(in_srgb,var(--warn)_24%,var(--border))] bg-warn-subtle p-4">
              <p className="text-sm font-semibold text-fg">Every rep will see this wording first.</p>
              <p className="mt-2 text-xs leading-relaxed text-fg-muted">Version {promoteTarget?.version ?? script.current?.version ?? '—'} becomes the standard for {script.taxonomyLabel}. The current standard stays in version history.</p>
            </div>
            <div className="mt-5 flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setPromoteOpen(false)} disabled={promoting}>Keep testing</Button>
              <Button className="flex-1" onClick={() => void handlePromote()} disabled={promoting || !promoteTarget}><Check aria-hidden size={14} /> {promoting ? 'Promoting…' : 'Promote'}</Button>
            </div>
          </>
        )}
      </Sheet>
    </div>
  )
}

function TaxonomyView({
  clientId,
  actorId,
  canManage,
  taxonomy,
  scripts,
  usageCounts,
  onChanged,
}: {
  clientId: string | null
  actorId: string | null
  canManage: boolean
  taxonomy: TaxonomyRow[]
  scripts: LibraryScript[]
  usageCounts: Map<string, number>
  onChanged: () => void
}) {
  const [newLabel, setNewLabel] = useState('')
  const [editing, setEditing] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rowError, setRowError] = useState<string | null>(null)
  const [mergeOpen, setMergeOpen] = useState(false)
  const [mergeFrom, setMergeFrom] = useState('')
  const [mergeInto, setMergeInto] = useState('')

  const activeOptions = taxonomy.filter((t) => t.status === 'active')

  const usageForTaxonomy = (id: string) => {
    const versions = scripts.find((s) => s.taxonomyId === id)?.versions ?? []
    return versions.reduce((sum, v) => sum + (usageCounts.get(v.id) ?? 0), 0)
  }

  const add = async () => {
    if (!newLabel.trim() || !clientId || !actorId) return
    setBusyId('new')
    setRowError(null)
    const result = await createTaxonomy(clientId, newLabel.trim(), actorId)
    setBusyId(null)
    if (!result.ok) {
      setRowError(result.message)
      return
    }
    setNewLabel('')
    onChanged()
  }

  const commitRename = async (id: string, currentLabel: string) => {
    const label = editing[id]
    if (label === undefined || !clientId || label === currentLabel) return
    setBusyId(id)
    setRowError(null)
    const result = await renameTaxonomy(clientId, id, label)
    setBusyId(null)
    if (!result.ok) {
      setRowError(result.message ?? 'Rename was blocked — check your role.')
      return
    }
    setEditing((all) => {
      const next = { ...all }
      delete next[id]
      return next
    })
    onChanged()
  }

  const toggleArchive = async (item: TaxonomyRow) => {
    if (!clientId) return
    setBusyId(item.id)
    setRowError(null)
    const result = await archiveTaxonomy(clientId, item.id, item.status === 'active' ? 'archived' : 'active')
    setBusyId(null)
    if (!result.ok) {
      setRowError(result.message ?? 'That change was blocked — check your role.')
      return
    }
    onChanged()
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-elev-1">
        <div className="border-b border-border p-4"><p className="label-caps text-accent">Company taxonomy</p><h3 className="mt-1 text-lg font-semibold text-fg">One language for every objection.</h3><p className="mt-1 text-xs text-fg-muted">Rename carefully. History follows the tag.</p></div>
        {rowError && <p role="alert" className="border-b border-border bg-danger-subtle px-4 py-2 text-xs text-danger">{rowError}</p>}
        <div>
          {taxonomy.map((item) => <div key={item.id} className={['flex items-center gap-3 border-b border-border px-4 py-3 last:border-0', item.status === 'archived' ? 'opacity-50' : ''].join(' ')}>
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-surface-sunk text-xs font-bold text-fg-muted">{item.label.slice(0, 1)}</span>
            <input
              value={editing[item.id] ?? item.label}
              onChange={(event) => setEditing((all) => ({ ...all, [item.id]: event.target.value }))}
              onBlur={() => void commitRename(item.id, item.label)}
              onKeyDown={(event) => event.key === 'Enter' && (event.currentTarget as HTMLInputElement).blur()}
              aria-label={`Rename ${item.label}`}
              disabled={!canManage || busyId === item.id}
              className="min-w-0 flex-1 rounded-md bg-transparent px-2 py-1.5 text-sm font-semibold text-fg hover:bg-surface-sunk focus:bg-surface-sunk disabled:opacity-60"
            />
            <span className="tnum text-xs text-fg-subtle">{usageForTaxonomy(item.id)} uses</span>
            <button onClick={() => void toggleArchive(item)} disabled={!canManage || busyId === item.id} aria-label={`${item.status === 'archived' ? 'Restore' : 'Archive'} ${item.label}`} className="rounded-md p-2 text-fg-subtle hover:bg-surface-sunk hover:text-fg disabled:opacity-40"><Archive aria-hidden size={14} /></button>
          </div>)}
          {!taxonomy.length && <p className="px-4 py-6 text-xs text-fg-muted">No objection tags yet.</p>}
        </div>
        <div className="flex gap-2 border-t border-border bg-surface-sunk p-3">
          <input value={newLabel} onChange={(event) => setNewLabel(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && void add()} placeholder="Add objection tag" aria-label="New objection tag" disabled={!canManage} className="h-9 min-w-0 flex-1 rounded-md border border-border bg-surface px-3 text-sm text-fg placeholder:text-fg-subtle disabled:opacity-60" />
          <Button size="sm" onClick={() => void add()} disabled={!canManage || !newLabel.trim() || busyId === 'new'}><Plus aria-hidden size={14} /> Add</Button>
        </div>
      </section>
      <aside className="rounded-xl border border-border bg-surface p-4 shadow-elev-1">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-subtle text-accent"><Merge aria-hidden size={18} /></span>
        <h3 className="mt-4 text-md font-semibold text-fg">Duplicate tags dilute learning.</h3>
        <p className="mt-2 text-xs leading-relaxed text-fg-muted">Merge two labels while keeping every historical log and feedback event.</p>
        <Button variant="secondary" className="mt-5 w-full" disabled={activeOptions.length < 2} onClick={() => { setMergeFrom(activeOptions[0]?.id ?? ''); setMergeInto(activeOptions[1]?.id ?? ''); setMergeOpen(true) }}>Merge tags</Button>
        <p className="mt-3 flex items-center gap-1.5 text-2xs text-fg-subtle"><SampleTag label="Sample" /> Needs its own transactional RPC — not built yet</p>
      </aside>

      <Sheet open={mergeOpen} onClose={() => setMergeOpen(false)} title="Merge objection tags">
        <label className="block text-xs font-semibold text-fg">Move all history from<select value={mergeFrom} onChange={(event) => setMergeFrom(event.target.value)} className="mt-2 h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-fg">{activeOptions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <label className="mt-4 block text-xs font-semibold text-fg">Into<select value={mergeInto} onChange={(event) => setMergeInto(event.target.value)} className="mt-2 h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-fg">{activeOptions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <div className="mt-5 rounded-md bg-warn-subtle p-3 text-xs leading-relaxed text-fg-muted">This cannot be undone from the interface. Scripts remain versioned; logs move to the surviving tag.</div>
        <Button className="mt-4 w-full" disabled={!mergeFrom || mergeFrom === mergeInto} onClick={() => setMergeOpen(false)}>Confirm merge</Button>
        <p className="mt-3 text-center text-2xs text-fg-subtle">Sample — not wired. No transactional merge RPC exists yet (out of scope for this pass).</p>
      </Sheet>
    </div>
  )
}

function ReadView({ scripts, usageCounts }: { scripts: LibraryScript[]; usageCounts: Map<string, number> }) {
  const standards = scripts.filter((s) => s.current?.status === 'standard' && s.current)
  return (
    <article className="mx-auto max-w-4xl overflow-hidden rounded-xl border border-border bg-surface shadow-elev-2">
      <header className="relative overflow-hidden border-b border-border px-6 py-10 sm:px-10 sm:py-14"><span aria-hidden className="absolute top-0 right-0 text-[140px] leading-none font-bold tracking-[-0.08em] text-surface-sunk">P</span><div className="relative max-w-xl"><p className="label-caps text-accent">Day-one field guide · 2026 edition</p><h2 className="mt-4 text-4xl font-semibold tracking-[-0.055em] text-fg">The Playbook</h2><p className="mt-4 text-md leading-relaxed text-fg-muted">Listen fully. Name the real concern. Use the company’s strongest starting point—then speak like a human.</p></div></header>
      {standards.length ? (
        <div className="divide-y divide-border">{standards.map((script, index) => {
          const version = script.current!
          const paragraphs = version.body?.paragraphs ?? []
          const uses = usageCounts.get(version.id) ?? 0
          return (
            <section key={script.taxonomyId} className="grid gap-5 px-6 py-8 sm:grid-cols-[100px_minmax(0,1fr)] sm:px-10">
              <div><span className="tnum text-4xl font-semibold tracking-[-0.05em] text-border-strong">{String(index + 1).padStart(2, '0')}</span><p className="label-caps mt-2">{script.taxonomyLabel}</p></div>
              <div>
                <h3 className="text-xl font-semibold tracking-[-0.03em] text-fg">{version.headline ?? script.taxonomyLabel}</h3>
                <div className="mt-4 space-y-3">{paragraphs.map((paragraph, paragraphIndex) => <p key={paragraphIndex} className="text-sm leading-7 text-fg-muted">{paragraph.before}{paragraph.highlight && <strong className="font-semibold text-fg">{paragraph.highlight}</strong>}{paragraph.after}</p>)}</div>
                <div className="mt-5 flex items-center gap-3 border-t border-border pt-3 text-2xs text-fg-subtle"><span>Standard v{version.version}</span><span>•</span><span>Owner {version.createdByName ?? 'Unknown'}</span><span>•</span><span>{uses ? `${uses} uses` : 'Not yet used'}</span></div>
              </div>
            </section>
          )
        })}</div>
      ) : (
        <div className="px-6 py-10 sm:px-10"><EmptyState icon={BookOpen} title="No standard scripts yet." body="Promote a tested version from the Editor to add it here." /></div>
      )}
      <footer className="flex items-center justify-between gap-4 bg-surface-sunk px-6 py-5 sm:px-10"><p className="text-xs text-fg-muted">Print-friendly reading view</p><span className="flex items-center gap-1 text-xs font-semibold text-accent">Start with the customer <ArrowRight aria-hidden size={13} /></span></footer>
    </article>
  )
}

export function Playbook({ canManage, previewState = 'ready' }: { canManage: boolean; previewState?: PreviewState }) {
  const { activeClient } = useClient()
  const { session } = useAuth()
  const clientId = activeClient?.id ?? null
  const actorId = session?.user.id ?? null

  const library = useScriptLibrary(clientId)
  const usage = useScriptUsageCounts(clientId)

  const [view, setView] = useState<PlaybookView>(canManage ? 'library' : 'read')
  const [selectedTaxonomyId, setSelectedTaxonomyId] = useState<string | null>(null)

  const activeScripts = useMemo(() => library.scripts.filter((s) => s.taxonomyStatus === 'active'), [library.scripts])
  const selected = activeScripts.find((s) => s.taxonomyId === selectedTaxonomyId) ?? activeScripts[0] ?? null

  if (previewState === 'loading') return <LoadingGrid />
  if (previewState === 'error') return <ErrorState title="Couldn’t load the Playbook" body="Your scripts are still safe. Check the connection and retry." onRetry={() => undefined} />
  if (library.loading) return <LoadingGrid />
  if (library.error) return <ErrorState title="Couldn’t load the Playbook" body={library.error} onRetry={library.reload} />

  const tabs: { key: PlaybookView; label: string; icon: typeof Library }[] = canManage
    ? [{ key: 'library', label: 'Library', icon: Library }, { key: 'editor', label: 'Editor', icon: PenLine }, { key: 'taxonomy', label: 'Taxonomy', icon: Merge }, { key: 'read', label: 'Read', icon: BookOpen }]
    : [{ key: 'read', label: 'The Playbook', icon: BookOpen }]

  const reloadAll = () => {
    void library.reload()
    void usage.reload()
  }

  return (
    <div>
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-border" role="tablist" aria-label="Playbook sections">{tabs.map((tab) => <button key={tab.key} role="tab" aria-selected={view === tab.key} onClick={() => setView(tab.key)} className={['flex min-h-11 shrink-0 items-center gap-1.5 border-b-2 px-3 text-xs font-semibold', view === tab.key ? 'border-accent text-fg' : 'border-transparent text-fg-muted hover:text-fg'].join(' ')}><tab.icon aria-hidden size={14} />{tab.label}</button>)}</div>
      {view === 'library' && <LibraryView scripts={activeScripts} usageCounts={usage.counts} onEdit={(script) => { setSelectedTaxonomyId(script.taxonomyId); setView('editor') }} />}
      {view === 'editor' && (selected ? (
        <EditorView
          key={selected.taxonomyId}
          clientId={clientId}
          actorId={actorId}
          script={selected}
          allScripts={activeScripts}
          onSelectTaxonomy={setSelectedTaxonomyId}
          onLibraryChange={reloadAll}
        />
      ) : (
        <EmptyState icon={PenLine} title="No objection tags yet." body="Add one from the Taxonomy tab, then come back to write its first script." />
      ))}
      {view === 'taxonomy' && (
        <TaxonomyView
          clientId={clientId}
          actorId={actorId}
          canManage={canManage}
          taxonomy={library.taxonomy}
          scripts={library.scripts}
          usageCounts={usage.counts}
          onChanged={reloadAll}
        />
      )}
      {view === 'read' && <ReadView scripts={library.scripts} usageCounts={usage.counts} />}
    </div>
  )
}
