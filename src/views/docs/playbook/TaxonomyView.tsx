import { useState } from 'react'
import { Archive, Plus } from 'lucide-react'
import { Button } from '../../../ui/Button'
import { Chip } from '../../../ui/Chip'
import { Sheet } from '../../../ui/Sheet'
import {
  COMPOSED_FROM_POSITION,
  archiveTaxonomy,
  createTaxonomy,
  renameTaxonomy,
  updateTaxonomyPlacement,
} from '../../../lib/scripts-data'
import type { LibraryScript, TaxonomyKind, TaxonomyRow } from '../../../lib/scripts-data'

// Governance: what the company calls each moment of the call, and in what
// order. Stages and objections are the same table (068) — kind is the only
// difference, and position is what the HUD reads.

function kindLabel(row: { kind: TaxonomyKind; position: number }): { text: string; tone: 'accent' | 'neutral' } {
  if (row.kind !== 'stage') return { text: 'Objection', tone: 'neutral' }
  return row.position >= COMPOSED_FROM_POSITION
    ? { text: 'Composed text', tone: 'neutral' }
    : { text: 'Stage', tone: 'accent' }
}

export function TaxonomyView({
  clientId,
  actorId,
  canManage,
  taxonomy,
  scripts,
  onChanged,
}: {
  clientId: string | null
  actorId: string | null
  canManage: boolean
  taxonomy: TaxonomyRow[]
  scripts: LibraryScript[]
  onChanged: () => void
}) {
  const [editing, setEditing] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rowError, setRowError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [newOpen, setNewOpen] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newKind, setNewKind] = useState<TaxonomyKind>('objection')
  const [newPosition, setNewPosition] = useState('0')

  const add = async () => {
    if (!newLabel.trim() || !clientId || !actorId) return
    setBusyId('new')
    setRowError(null)
    const result = await createTaxonomy(clientId, newLabel.trim(), actorId, {
      kind: newKind,
      position: Number(newPosition) || 0,
    })
    setBusyId(null)
    if (!result.ok) {
      setRowError(result.message)
      return
    }
    setNewLabel('')
    setNewPosition('0')
    setNewOpen(false)
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

  const commitPosition = async (item: TaxonomyRow, value: string) => {
    const position = Number(value)
    if (!clientId || !Number.isFinite(position) || position === item.position) return
    setBusyId(item.id)
    setRowError(null)
    const result = await updateTaxonomyPlacement(clientId, item.id, { position })
    setBusyId(null)
    if (!result.ok) {
      setRowError(result.message ?? 'That change was blocked — check your role.')
      return
    }
    onChanged()
  }

  const toggleArchive = async (item: TaxonomyRow) => {
    if (!clientId) return
    // Archiving a stage that owns the only standard WARNS but does not block:
    // the manager may well be retiring a step on purpose, and a hard stop would
    // just send them to SQL.
    if (item.status === 'active') {
      const script = scripts.find((s) => s.taxonomyId === item.id)
      if (item.kind === 'stage' && script?.current?.status === 'standard') {
        setWarning(`“${item.label}” held the only standard script for that step. Reps will see a gap there until you add one.`)
      }
    }
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
    <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-elev-1">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border p-4">
        <div>
          <p className="label-caps text-accent">Company taxonomy</p>
          <h3 className="mt-1 text-md font-semibold text-fg">One language for every moment of the call.</h3>
          <p className="mt-1 text-xs text-fg-muted">Position orders the roadmap. 90 and above are composed texts.</p>
        </div>
        <Button size="sm" onClick={() => setNewOpen(true)} disabled={!canManage}>
          <Plus aria-hidden size={14} /> New
        </Button>
      </div>

      {rowError && (
        <p role="alert" className="border-b border-border bg-danger-subtle px-4 py-2 text-xs text-danger">
          {rowError}
        </p>
      )}
      {warning && (
        <p role="status" className="border-b border-border bg-warn-subtle px-4 py-2 text-xs text-fg">
          {warning}
        </p>
      )}

      <div>
        {taxonomy.map((item) => {
          const kind = kindLabel(item)
          return (
            <div
              key={item.id}
              className={[
                'flex flex-wrap items-center gap-2 border-b border-border px-4 py-3 last:border-0 sm:flex-nowrap sm:gap-3',
                item.status === 'archived' ? 'opacity-50' : '',
              ].join(' ')}
            >
              <Chip tone={kind.tone}>{kind.text}</Chip>
              <input
                value={editing[item.id] ?? item.label}
                onChange={(event) => setEditing((all) => ({ ...all, [item.id]: event.target.value }))}
                onBlur={() => void commitRename(item.id, item.label)}
                onKeyDown={(event) => event.key === 'Enter' && (event.currentTarget as HTMLInputElement).blur()}
                aria-label={`Rename ${item.label}`}
                disabled={!canManage || busyId === item.id}
                className="min-w-0 flex-1 rounded-md bg-transparent px-2 py-1.5 text-sm font-semibold text-fg hover:bg-surface-sunk focus:bg-surface-sunk disabled:opacity-60"
              />
              <label className="flex items-center gap-1.5 text-2xs text-fg-subtle">
                Position
                <input
                  type="number"
                  defaultValue={item.position}
                  onBlur={(event) => void commitPosition(item, event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && (event.currentTarget as HTMLInputElement).blur()}
                  aria-label={`Position of ${item.label}`}
                  disabled={!canManage || busyId === item.id}
                  className="tnum h-8 w-16 rounded-md border border-border bg-surface-sunk px-2 text-xs text-fg disabled:opacity-60"
                />
              </label>
              <button
                onClick={() => void toggleArchive(item)}
                disabled={!canManage || busyId === item.id}
                aria-label={`${item.status === 'archived' ? 'Restore' : 'Archive'} ${item.label}`}
                className="rounded-md p-2 text-fg-subtle hover:bg-surface-sunk hover:text-fg disabled:opacity-40"
              >
                <Archive aria-hidden size={14} />
              </button>
            </div>
          )
        })}
        {!taxonomy.length && <p className="px-4 py-6 text-xs text-fg-muted">Nothing in the taxonomy yet.</p>}
      </div>

      <Sheet open={newOpen} onClose={() => setNewOpen(false)} title="New taxonomy row">
        <fieldset>
          <legend className="text-xs font-semibold text-fg">What is it?</legend>
          <div className="mt-2 grid gap-2">
            {(
              [
                ['objection', 'Objection', 'Something the customer says back.'],
                ['stage', 'Stage or composed text', 'A step in the call, or a text the rep sends.'],
              ] as const
            ).map(([key, label, detail]) => (
              <button
                key={key}
                onClick={() => setNewKind(key)}
                aria-pressed={newKind === key}
                className={[
                  'flex items-center gap-3 rounded-lg border p-3 text-left',
                  newKind === key ? 'border-accent bg-accent-subtle' : 'border-border hover:border-border-strong',
                ].join(' ')}
              >
                <span
                  className={['h-3 w-3 rounded-pill border-2', newKind === key ? 'border-accent bg-accent' : 'border-border-strong'].join(' ')}
                />
                <span className="min-w-0 flex-1">
                  <strong className="block text-xs text-fg">{label}</strong>
                  <span className="mt-0.5 block text-2xs leading-relaxed text-fg-muted">{detail}</span>
                </span>
              </button>
            ))}
          </div>
        </fieldset>

        <label className="mt-4 block text-xs font-semibold text-fg">
          Label
          <input
            value={newLabel}
            onChange={(event) => setNewLabel(event.target.value)}
            placeholder="Ask parents / spouse"
            className="mt-2 h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-fg placeholder:text-fg-subtle"
          />
        </label>
        <label className="mt-4 block text-xs font-semibold text-fg">
          Position
          <input
            type="number"
            value={newPosition}
            onChange={(event) => setNewPosition(event.target.value)}
            className="tnum mt-2 h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-fg"
          />
          <span className="mt-1 block text-2xs font-normal text-fg-muted">
            Lower comes first. 90 and above means a composed text, off the roadmap.
          </span>
        </label>

        <Button className="mt-5 w-full" onClick={() => void add()} disabled={!newLabel.trim() || busyId === 'new'}>
          Add to taxonomy
        </Button>
      </Sheet>
    </section>
  )
}
