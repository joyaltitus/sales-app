import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Avatar } from '../../../ui/Avatar'
import { Chip } from '../../../ui/Chip'
import { EmptyState } from '../../../ui/EmptyState'
import { COMPOSED_FROM_POSITION } from '../../../lib/scripts-data'
import type { LibraryScript, WinRate } from '../../../lib/scripts-data'
import { resolveParagraphs, variantLangs } from '../../../lib/script-body'
import { DialectDots, STATUS_TONE, WinRateChip, formatDate } from './shared'

// The library is the manager's map of the whole playbook. It groups by what the
// script IS rather than by status: the call roadmap in the order it is spoken,
// then the objections, then the composed texts a rep sends rather than says.

type Filter = 'all' | 'roadmap' | 'objections' | 'untranslated' | 'untested'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'roadmap', label: 'Roadmap' },
  { key: 'objections', label: 'Objections' },
  { key: 'untranslated', label: 'Needs translation' },
  { key: 'untested', label: 'Untested' },
]

function firstLine(script: LibraryScript): string {
  const { paragraphs } = resolveParagraphs(script.current?.body, script.current?.body?.lang ?? 'en')
  const p = paragraphs[0]
  if (!p) return ''
  return `${p.before}${p.highlight ?? ''}${p.after ?? ''}`
}

function ScriptCard({
  script,
  rate,
  offered,
  index,
  onOpen,
}: {
  script: LibraryScript
  rate: WinRate | undefined
  offered: string[]
  index?: number
  onOpen: () => void
}) {
  const version = script.current
  const present = variantLangs(version?.body)
  const line = firstLine(script)
  const highlight = version?.body?.paragraphs?.[0]?.highlight

  return (
    <button
      onClick={onOpen}
      className="group flex min-h-48 flex-col rounded-xl border border-border bg-surface p-4 text-left shadow-elev-1 transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-border-strong hover:shadow-elev-2"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="tnum flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-subtle text-sm font-bold text-accent">
          {index === undefined ? script.taxonomyLabel.slice(0, 1) : String(index).padStart(2, '0')}
        </span>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <WinRateChip rate={rate} />
          <Chip tone={version ? STATUS_TONE[version.status] : 'neutral'}>
            {version ? `v${version.version} ${version.status}` : 'No script'}
          </Chip>
        </div>
      </div>

      <h3 className="mt-3 text-md font-semibold tracking-[-0.02em] text-fg">{script.taxonomyLabel}</h3>
      <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-fg-muted">
        {line ? (
          <>
            {version?.body?.paragraphs?.[0]?.before}
            {highlight && <strong className="font-semibold text-fg">{highlight}</strong>}
            {version?.body?.paragraphs?.[0]?.after}
          </>
        ) : (
          'No script authored yet — open the editor to write the first draft.'
        )}
      </p>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3">
        <span className="flex min-w-0 items-center gap-2">
          <Avatar name={version?.createdByName ?? null} size="sm" />
          <span className="min-w-0 text-2xs text-fg-muted">
            <span className="block truncate">{version?.createdByName ?? 'Unassigned'}</span>
            <span className="block text-fg-subtle">{formatDate(version?.createdAt)}</span>
          </span>
        </span>
        <DialectDots present={present} offered={offered} />
      </div>
    </button>
  )
}

function Group({
  title,
  note,
  scripts,
  numbered,
  rates,
  offered,
  onEdit,
}: {
  title: string
  note: string
  scripts: LibraryScript[]
  numbered: boolean
  rates: Map<string, WinRate>
  offered: string[]
  onEdit: (script: LibraryScript) => void
}) {
  if (!scripts.length) return null
  return (
    <section className="mt-5 first:mt-4">
      <div className="mb-2.5 flex items-baseline gap-2">
        <h3 className="text-sm font-semibold text-fg">{title}</h3>
        <p className="text-2xs text-fg-muted">{note}</p>
        <span className="tnum ml-auto text-2xs text-fg-subtle">{scripts.length}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {scripts.map((script, i) => (
          <ScriptCard
            key={script.taxonomyId}
            script={script}
            rate={script.current ? rates.get(script.current.id) : undefined}
            offered={offered}
            index={numbered ? i + 1 : undefined}
            onOpen={() => onEdit(script)}
          />
        ))}
      </div>
    </section>
  )
}

export function LibraryView({
  scripts,
  rates,
  offered,
  onEdit,
}: {
  scripts: LibraryScript[]
  rates: Map<string, WinRate>
  offered: string[]
  onEdit: (script: LibraryScript) => void
}) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return scripts.filter((script) => {
      const present = variantLangs(script.current?.body)
      const missingDialect = offered.some((lang) => !present.includes(lang))
      const rate = script.current ? rates.get(script.current.id) : undefined
      if (filter === 'roadmap' && !(script.kind === 'stage' && script.position < COMPOSED_FROM_POSITION)) return false
      if (filter === 'objections' && script.kind !== 'objection') return false
      if (filter === 'untranslated' && !missingDialect) return false
      if (filter === 'untested' && (rate?.rated ?? 0) > 0) return false
      if (!q) return true
      return (
        script.taxonomyLabel.toLowerCase().includes(q) ||
        (script.current?.headline ?? '').toLowerCase().includes(q) ||
        firstLine(script).toLowerCase().includes(q)
      )
    })
  }, [scripts, query, filter, offered, rates])

  const roadmap = visible.filter((s) => s.kind === 'stage' && s.position < COMPOSED_FROM_POSITION)
  const objections = visible.filter((s) => s.kind === 'objection')
  const composed = visible.filter((s) => s.kind === 'stage' && s.position >= COMPOSED_FROM_POSITION)

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface p-2 shadow-elev-1">
        <div className="relative min-w-52 flex-1">
          <Search aria-hidden size={14} className="absolute top-1/2 left-3 -translate-y-1/2 text-fg-subtle" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search scripts"
            placeholder="Search a stage, objection or phrase"
            className="h-10 w-full rounded-md bg-surface-sunk pr-3 pl-9 text-sm text-fg placeholder:text-fg-subtle"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto" role="group" aria-label="Filter scripts">
          {FILTERS.map((item) => (
            <button
              key={item.key}
              onClick={() => setFilter(item.key)}
              aria-pressed={filter === item.key}
              className={[
                'min-h-9 shrink-0 rounded-md px-3 text-xs font-semibold',
                filter === item.key ? 'bg-accent-subtle text-accent' : 'text-fg-muted hover:bg-surface-sunk hover:text-fg',
              ].join(' ')}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {visible.length ? (
        <>
          <Group
            title="Call roadmap"
            note="In the order the call runs"
            scripts={roadmap}
            numbered
            rates={rates}
            offered={offered}
            onEdit={onEdit}
          />
          <Group
            title="Objections"
            note="What they say back"
            scripts={objections}
            numbered={false}
            rates={rates}
            offered={offered}
            onEdit={onEdit}
          />
          <Group
            title="Composed texts"
            note="Sent, not spoken"
            scripts={composed}
            numbered={false}
            rates={rates}
            offered={offered}
            onEdit={onEdit}
          />
        </>
      ) : (
        <div className="mt-4">
          <EmptyState
            icon={Search}
            title="No scripts match."
            body="Clear the search or switch the filter. The taxonomy itself is unchanged."
          />
        </div>
      )}
    </div>
  )
}
