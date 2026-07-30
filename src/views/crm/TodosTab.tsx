import { useMemo, useState } from 'react'
import { Check, NotebookPen } from 'lucide-react'
import { useMockTodos } from '../../lib/mock-data'
import { SampleBanner } from './CrmScreen'

// Todos — SAMPLE DATA for the proposed `employee_todos` concept (Wave 1 of
// sales-ecosystem-brainstorm-seed.md). There is NO table behind this yet; the
// row shape in lib/mock-data.ts is the UI's proposal for it. Toggling Done
// works for the session and writes nowhere.

const capsStyle = {
  fontWeight: 'var(--weight-caps)',
  letterSpacing: 'var(--tracking-caps)',
} as const

const monoStyle = { fontFamily: 'var(--font-mono)' } as const

const SOURCE_LABEL = {
  follow_up: 'Follow-up',
  escalation: 'Escalation',
  manual: 'Manual',
} as const

function dueStamp(iso: string, now: number): string {
  const diff = new Date(iso).getTime() - now
  const abs = Math.abs(diff)
  const m = Math.max(1, Math.round(abs / 60_000))
  const stamp = m < 60 ? `${m}m` : m < 24 * 60 ? `${Math.round(m / 60)}h` : `${Math.round(m / (24 * 60))}d`
  return diff < 0 ? `${stamp} late` : `in ${stamp}`
}

export function TodosTab() {
  const { items, toggle, setNote } = useMockTodos()
  const [noteFor, setNoteFor] = useState<string | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  // Mock fixtures pin their own clock so overdue rows stay overdue in
  // screenshots; real wiring replaces this with Date.now().
  const now = useMemo(() => Date.now(), [])

  const pending = items.filter((t) => t.status === 'pending')
  const done = items.filter((t) => t.status === 'done')

  const row = (t: (typeof items)[number]) => {
    const overdue = t.status === 'pending' && new Date(t.due_at).getTime() < now
    return (
      <div key={t.id} className="border-b border-border bg-surface px-4 py-3">
      <div className="flex items-center gap-3">
        <button
          onClick={() => toggle(t.id)}
          aria-pressed={t.status === 'done'}
          aria-label={`Mark "${t.title}" ${t.status === 'done' ? 'not done' : 'done'} (sample, not saved)`}
          title="Sample control — not saved"
          className={[
            'flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border border-dashed transition-colors',
            t.status === 'done'
              ? 'border-transparent bg-accent-subtle text-accent'
              : 'border-border-strong text-transparent hover:text-fg-subtle',
          ].join(' ')}
        >
          <Check aria-hidden size={13} strokeWidth={2.5} />
        </button>
        <div className="min-w-0 flex-1">
          <div
            className={[
              'truncate text-sm',
              t.status === 'done' ? 'text-fg-subtle line-through' : 'text-fg',
            ].join(' ')}
          >
            {t.title}
          </div>
          <div className="mt-0.5 flex items-center gap-3">
            <span className="text-2xs text-fg-subtle uppercase" style={capsStyle}>
              {t.assignee}
            </span>
            <span className="text-2xs text-fg-subtle uppercase" style={capsStyle}>
              {SOURCE_LABEL[t.source]}
            </span>
          </div>
        </div>
        {t.status === 'pending' && (
          <span
            className={['tnum shrink-0 text-sm', overdue ? 'text-danger' : 'text-fg-subtle'].join(' ')}
            style={monoStyle}
          >
            {dueStamp(t.due_at, now)}
          </span>
        )}
        <button
          onClick={() => {
            setNoteFor((cur) => (cur === t.id ? null : t.id))
            setNoteDraft(t.note ?? '')
          }}
          aria-label={`Note on "${t.title}"`}
          title="Add note"
          className={[
            'shrink-0 rounded-sm p-1.5 hover:bg-surface-sunk',
            t.note ? 'text-fg-muted' : 'text-fg-subtle',
          ].join(' ')}
        >
          <NotebookPen aria-hidden size={14} strokeWidth={1.75} />
        </button>
      </div>

      {t.note && noteFor !== t.id && (
        <p className="mt-1.5 pl-8 text-xs text-fg-muted">{t.note}</p>
      )}
      {noteFor === t.id && (
        <div className="mt-2 flex items-center gap-2 pl-8">
          <input
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setNote(t.id, noteDraft.trim())
                setNoteFor(null)
              }
            }}
            placeholder="How did it go / what's blocking"
            aria-label="Todo note"
            autoFocus
            className="h-8 min-w-0 flex-1 rounded-md border border-border bg-surface px-2.5 text-xs text-fg placeholder:text-fg-subtle hover:border-border-strong"
          />
          <button
            onClick={() => {
              setNote(t.id, noteDraft.trim())
              setNoteFor(null)
            }}
            className="rounded-md border border-border px-2.5 py-1.5 text-2xs font-semibold text-fg-muted hover:border-border-strong hover:text-fg"
          >
            Save
          </button>
        </div>
      )}
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SampleBanner>Sample data — employee todos are a proposed concept, not a table yet</SampleBanner>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {pending.map(row)}
        {done.length > 0 && (
          <>
            <h2
              className="border-b border-border bg-surface-sunk px-4 py-1.5 text-2xs text-fg-subtle uppercase"
              style={capsStyle}
            >
              Done
            </h2>
            {done.map(row)}
          </>
        )}
      </div>
    </div>
  )
}
