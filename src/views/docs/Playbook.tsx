import { useMemo, useState } from 'react'
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
import { OBJECTION_LABELS, OBJECTION_SCRIPTS } from '../objections/objectionMocks'
import type { ObjectionKey, ObjectionScriptPreview, ScriptStatus } from '../objections/objectionMocks'

type PlaybookView = 'library' | 'editor' | 'taxonomy' | 'read'
type PreviewState = 'ready' | 'loading' | 'error'

const STATUS_TONE: Record<ScriptStatus, 'neutral' | 'warn' | 'success'> = {
  draft: 'neutral',
  testing: 'warn',
  standard: 'success',
}

const VERSION_COPY: Record<number, string> = {
  1: 'Start by validating the concern. Explain the available option, then ask one direct question.',
  2: 'Validate the concern. Compare the specific support included, then ask which proof matters most.',
  3: 'Name the concern in their words. Reframe around the cost of waiting, then offer one concrete next step.',
  4: 'That makes sense — the fee should feel justified. Compare the outcome, not only the fee. Then make the instalment option concrete.',
  5: 'Acknowledge the timing. Separate the start date, decision date, and payment date before proposing the next step.',
}

function ScriptCard({ script, onOpen }: { script: ObjectionScriptPreview; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="group flex min-h-56 flex-col rounded-xl border border-border bg-surface p-4 text-left shadow-elev-1 transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-border-strong hover:shadow-elev-2">
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-subtle text-sm font-bold text-accent">{script.label.slice(0, 1)}</span>
        <div className="flex items-center gap-1.5"><Chip tone={STATUS_TONE[script.status]}>{script.status[0].toUpperCase() + script.status.slice(1)}</Chip><span className="tnum text-2xs text-fg-subtle">v{script.version}</span></div>
      </div>
      <h3 className="mt-4 text-lg font-semibold tracking-[-0.025em] text-fg">{script.label}</h3>
      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-fg-muted">{script.headline}</p>
      <div className="mt-auto pt-5">
        <div className="flex items-center justify-between border-t border-border pt-3">
          <span className="flex items-center gap-2"><Avatar name={script.author} size="sm" /><span className="text-2xs text-fg-muted">{script.author}<span className="block text-fg-subtle">{script.updatedAt}</span></span></span>
          <span className="text-right"><strong className="tnum block text-md text-fg">{script.winRate == null ? '—' : `${script.winRate}%`}</strong><span className="text-2xs text-fg-subtle">won after use</span></span>
        </div>
      </div>
    </button>
  )
}

function LibraryView({ onEdit }: { onEdit: (script: ObjectionScriptPreview) => void }) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<ScriptStatus | 'all'>('all')
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return OBJECTION_SCRIPTS.filter((script) => (status === 'all' || script.status === status) && (!q || script.label.toLowerCase().includes(q) || script.headline.toLowerCase().includes(q)))
  }, [query, status])

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
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{visible.map((script) => <ScriptCard key={script.key} script={script} onOpen={() => onEdit(script)} />)}</div>
      ) : (
        <EmptyState icon={Search} title="No scripts match." body="Clear the search or switch the status filter. The objection taxonomy remains unchanged." />
      )}
    </div>
  )
}

function EditorView({ script, onSelect }: { script: ObjectionScriptPreview; onSelect: (script: ObjectionScriptPreview) => void }) {
  const [compare, setCompare] = useState(true)
  const [draft, setDraft] = useState(script.paragraphs.map((part) => `${part.before}${part.highlight ?? ''}${part.after ?? ''}`).join('\n\n'))
  const [selectedVersion, setSelectedVersion] = useState(Math.max(1, script.version - 1))
  const [promoteOpen, setPromoteOpen] = useState(false)
  const [promoted, setPromoted] = useState(false)
  const [assist, setAssist] = useState<string | null>(null)

  const switchScript = (next: ObjectionScriptPreview) => {
    onSelect(next)
    setDraft(next.paragraphs.map((part) => `${part.before}${part.highlight ?? ''}${part.after ?? ''}`).join('\n\n'))
    setSelectedVersion(Math.max(1, next.version - 1))
    setPromoted(false)
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[190px_minmax(0,1fr)]">
      <aside className="rounded-xl border border-border bg-surface p-3 shadow-elev-1">
        <p className="label-caps px-2">Objections</p>
        <div className="mt-2 space-y-1">{OBJECTION_SCRIPTS.map((item) => <button key={item.key} onClick={() => switchScript(item)} className={['flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-xs font-semibold', item.key === script.key ? 'bg-accent-subtle text-accent' : 'text-fg-muted hover:bg-surface-sunk hover:text-fg'].join(' ')}><span>{item.label}</span><span className="tnum text-2xs">v{item.version}</span></button>)}</div>
      </aside>

      <main className="overflow-hidden rounded-xl border border-border bg-surface shadow-elev-2">
        <header className="flex flex-wrap items-center gap-3 border-b border-border bg-surface-raised p-4">
          <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h3 className="text-lg font-semibold text-fg">{script.label}</h3><Chip tone={promoted || script.status === 'standard' ? 'success' : STATUS_TONE[script.status]}>{promoted ? 'Standard' : script.status}</Chip></div><p className="mt-1 text-2xs text-fg-muted">Editing creates v{script.version + 1} · Preview — not wired</p></div>
          <Button variant="secondary" size="sm" onClick={() => setCompare((value) => !value)}><GitCompareArrows aria-hidden size={14} /> {compare ? 'Hide compare' : 'Compare'}</Button>
          <Button size="sm" onClick={() => setPromoteOpen(true)}><ChevronsUp aria-hidden size={14} /> Promote</Button>
        </header>

        <div className="grid min-h-[470px] xl:grid-cols-[150px_minmax(0,1fr)]">
          <aside className="border-b border-border bg-surface-sunk p-3 xl:border-r xl:border-b-0">
            <p className="label-caps flex items-center gap-1"><History aria-hidden size={12} /> Version history</p>
            <div className="mt-3 flex gap-2 overflow-x-auto xl:block xl:space-y-1">{Array.from({ length: script.version }, (_, index) => script.version - index).map((version) => <button key={version} onClick={() => setSelectedVersion(version)} className={['min-w-24 rounded-md px-2.5 py-2 text-left text-xs xl:w-full', selectedVersion === version ? 'bg-surface-raised font-semibold text-fg shadow-elev-1' : 'text-fg-muted hover:text-fg'].join(' ')}><span className="tnum block">Version {version}</span><span className="mt-0.5 block text-2xs text-fg-subtle">{version === script.version ? 'Current' : `${script.version - version + 1} weeks ago`}</span></button>)}</div>
          </aside>

          <div className="p-4">
            <div className={compare ? 'grid gap-4 lg:grid-cols-2' : ''}>
              {compare && <section><div className="mb-2 flex items-center justify-between"><p className="label-caps">Version {selectedVersion}</p><span className="text-2xs text-fg-subtle">Read only</span></div><div className="min-h-64 whitespace-pre-wrap rounded-lg border border-border bg-surface-sunk p-4 text-sm leading-7 text-fg-muted">{VERSION_COPY[selectedVersion] ?? VERSION_COPY[1]}</div></section>}
              <section><div className="mb-2 flex items-center justify-between"><p className="label-caps text-accent">Draft v{script.version + 1}</p><span className="text-2xs text-fg-subtle">Autosave preview</span></div><textarea value={draft} onChange={(event) => setDraft(event.target.value)} aria-label="Script draft" className="min-h-64 w-full resize-y rounded-lg border border-border bg-surface-raised p-4 text-sm leading-7 text-fg shadow-[var(--inset-highlight)]" /></section>
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

      <Sheet open={promoteOpen} onClose={() => setPromoteOpen(false)} title="Promote to company standard?">
        <div className="rounded-lg border border-[color-mix(in_srgb,var(--warn)_24%,var(--border))] bg-warn-subtle p-4">
          <p className="text-sm font-semibold text-fg">Every rep will see this wording first.</p>
          <p className="mt-2 text-xs leading-relaxed text-fg-muted">Version {script.version + 1} becomes the standard for {script.label}. The current standard stays in version history.</p>
        </div>
        <div className="mt-5 flex gap-2"><Button variant="secondary" className="flex-1" onClick={() => setPromoteOpen(false)}>Keep testing</Button><Button className="flex-1" onClick={() => { setPromoted(true); setPromoteOpen(false) }}><Check aria-hidden size={14} /> Promote</Button></div>
        <p className="mt-3 text-center text-2xs text-fg-subtle">Preview — action is not wired</p>
      </Sheet>
    </div>
  )
}

type TaxonomyItem = { key: ObjectionKey; label: string; count: number; archived: boolean }

function TaxonomyView() {
  const [items, setItems] = useState<TaxonomyItem[]>(OBJECTION_LABELS.map((item, index) => ({ ...item, count: [126, 42, 84, 109, 37, 8][index] ?? 0, archived: false })))
  const [newLabel, setNewLabel] = useState('')
  const [mergeOpen, setMergeOpen] = useState(false)
  const [mergeFrom, setMergeFrom] = useState<ObjectionKey>('quality')
  const [mergeInto, setMergeInto] = useState<ObjectionKey>('trust')

  const add = () => {
    if (!newLabel.trim()) return
    setItems((all) => [...all, { key: 'custom', label: newLabel.trim(), count: 0, archived: false }])
    setNewLabel('')
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-elev-1">
        <div className="border-b border-border p-4"><p className="label-caps text-accent">Company taxonomy</p><h3 className="mt-1 text-lg font-semibold text-fg">One language for every objection.</h3><p className="mt-1 text-xs text-fg-muted">Rename carefully. History follows the tag.</p></div>
        <div>{items.map((item) => <div key={`${item.key}-${item.label}`} className={['flex items-center gap-3 border-b border-border px-4 py-3 last:border-0', item.archived ? 'opacity-50' : ''].join(' ')}><span className="flex h-8 w-8 items-center justify-center rounded-md bg-surface-sunk text-xs font-bold text-fg-muted">{item.label.slice(0, 1)}</span><input value={item.label} onChange={(event) => setItems((all) => all.map((row) => row === item ? { ...row, label: event.target.value } : row))} aria-label={`Rename ${item.label}`} className="min-w-0 flex-1 rounded-md bg-transparent px-2 py-1.5 text-sm font-semibold text-fg hover:bg-surface-sunk focus:bg-surface-sunk" /><span className="tnum text-xs text-fg-subtle">{item.count} logs</span><button onClick={() => setItems((all) => all.map((row) => row === item ? { ...row, archived: !row.archived } : row))} aria-label={`${item.archived ? 'Restore' : 'Archive'} ${item.label}`} className="rounded-md p-2 text-fg-subtle hover:bg-surface-sunk hover:text-fg"><Archive aria-hidden size={14} /></button></div>)}</div>
        <div className="flex gap-2 border-t border-border bg-surface-sunk p-3"><input value={newLabel} onChange={(event) => setNewLabel(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && add()} placeholder="Add objection tag" aria-label="New objection tag" className="h-9 min-w-0 flex-1 rounded-md border border-border bg-surface px-3 text-sm text-fg placeholder:text-fg-subtle" /><Button size="sm" onClick={add} disabled={!newLabel.trim()}><Plus aria-hidden size={14} /> Add</Button></div>
      </section>
      <aside className="rounded-xl border border-border bg-surface p-4 shadow-elev-1"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-subtle text-accent"><Merge aria-hidden size={18} /></span><h3 className="mt-4 text-md font-semibold text-fg">Duplicate tags dilute learning.</h3><p className="mt-2 text-xs leading-relaxed text-fg-muted">Merge two labels while keeping every historical log and feedback event.</p><Button variant="secondary" className="mt-5 w-full" onClick={() => setMergeOpen(true)}>Merge tags</Button><p className="mt-3 text-2xs text-fg-subtle">Preview — taxonomy changes are not saved</p></aside>

      <Sheet open={mergeOpen} onClose={() => setMergeOpen(false)} title="Merge objection tags">
        <label className="block text-xs font-semibold text-fg">Move all history from<select value={mergeFrom} onChange={(event) => setMergeFrom(event.target.value as ObjectionKey)} className="mt-2 h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-fg">{items.filter((item) => !item.archived).map((item) => <option key={item.key + item.label} value={item.key}>{item.label}</option>)}</select></label>
        <label className="mt-4 block text-xs font-semibold text-fg">Into<select value={mergeInto} onChange={(event) => setMergeInto(event.target.value as ObjectionKey)} className="mt-2 h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-fg">{items.filter((item) => !item.archived).map((item) => <option key={item.key + item.label} value={item.key}>{item.label}</option>)}</select></label>
        <div className="mt-5 rounded-md bg-warn-subtle p-3 text-xs leading-relaxed text-fg-muted">This cannot be undone from the interface. Scripts remain versioned; logs move to the surviving tag.</div>
        <Button className="mt-4 w-full" disabled={mergeFrom === mergeInto} onClick={() => setMergeOpen(false)}>Confirm merge</Button>
      </Sheet>
    </div>
  )
}

function ReadView() {
  const standards = OBJECTION_SCRIPTS.filter((script) => script.status === 'standard')
  return (
    <article className="mx-auto max-w-4xl overflow-hidden rounded-xl border border-border bg-surface shadow-elev-2">
      <header className="relative overflow-hidden border-b border-border px-6 py-10 sm:px-10 sm:py-14"><span aria-hidden className="absolute top-0 right-0 text-[140px] leading-none font-bold tracking-[-0.08em] text-surface-sunk">P</span><div className="relative max-w-xl"><p className="label-caps text-accent">Day-one field guide · 2026 edition</p><h2 className="mt-4 text-4xl font-semibold tracking-[-0.055em] text-fg">The Playbook</h2><p className="mt-4 text-md leading-relaxed text-fg-muted">Listen fully. Name the real concern. Use the company’s strongest starting point—then speak like a human.</p></div></header>
      <div className="divide-y divide-border">{standards.map((script, index) => <section key={script.key} className="grid gap-5 px-6 py-8 sm:grid-cols-[100px_minmax(0,1fr)] sm:px-10"><div><span className="tnum text-4xl font-semibold tracking-[-0.05em] text-border-strong">{String(index + 1).padStart(2, '0')}</span><p className="label-caps mt-2">{script.label}</p></div><div><h3 className="text-xl font-semibold tracking-[-0.03em] text-fg">{script.headline}</h3><div className="mt-4 space-y-3">{script.paragraphs.map((paragraph, paragraphIndex) => <p key={paragraphIndex} className="text-sm leading-7 text-fg-muted">{paragraph.before}{paragraph.highlight && <strong className="font-semibold text-fg">{paragraph.highlight}</strong>}{paragraph.after}</p>)}</div><div className="mt-5 flex items-center gap-3 border-t border-border pt-3 text-2xs text-fg-subtle"><span>Standard v{script.version}</span><span>•</span><span>Owner {script.author}</span><span>•</span><span>{script.winRate}% won after use</span></div></div></section>)}</div>
      <footer className="flex items-center justify-between gap-4 bg-surface-sunk px-6 py-5 sm:px-10"><p className="text-xs text-fg-muted">Print-friendly reading view · Preview data</p><span className="flex items-center gap-1 text-xs font-semibold text-accent">Start with the customer <ArrowRight aria-hidden size={13} /></span></footer>
    </article>
  )
}

export function Playbook({ canManage, previewState = 'ready' }: { canManage: boolean; previewState?: PreviewState }) {
  const [view, setView] = useState<PlaybookView>(canManage ? 'library' : 'read')
  const [selected, setSelected] = useState(OBJECTION_SCRIPTS[0])

  if (previewState === 'loading') return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><Skeleton className="h-56" /><Skeleton className="h-56" /><Skeleton className="h-56" /></div>
  if (previewState === 'error') return <ErrorState title="Couldn’t load the Playbook" body="Your scripts are still safe. Check the connection and retry." onRetry={() => undefined} />

  const tabs: { key: PlaybookView; label: string; icon: typeof Library }[] = canManage
    ? [{ key: 'library', label: 'Library', icon: Library }, { key: 'editor', label: 'Editor', icon: PenLine }, { key: 'taxonomy', label: 'Taxonomy', icon: Merge }, { key: 'read', label: 'Read', icon: BookOpen }]
    : [{ key: 'read', label: 'The Playbook', icon: BookOpen }]

  return (
    <div>
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-border" role="tablist" aria-label="Playbook sections">{tabs.map((tab) => <button key={tab.key} role="tab" aria-selected={view === tab.key} onClick={() => setView(tab.key)} className={['flex min-h-11 shrink-0 items-center gap-1.5 border-b-2 px-3 text-xs font-semibold', view === tab.key ? 'border-accent text-fg' : 'border-transparent text-fg-muted hover:text-fg'].join(' ')}><tab.icon aria-hidden size={14} />{tab.label}</button>)}</div>
      {view === 'library' && <LibraryView onEdit={(script) => { setSelected(script); setView('editor') }} />}
      {view === 'editor' && <EditorView script={selected} onSelect={setSelected} />}
      {view === 'taxonomy' && <TaxonomyView />}
      {view === 'read' && <ReadView />}
    </div>
  )
}
