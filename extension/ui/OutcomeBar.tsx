import { useState } from 'react'
import type { CallOutcome, QueueItem } from '../lib/contracts'
import { Button } from '../../src/ui/Button'

export type Option = { key: string; label: string }

type Props = {
  stages: Option[]
  stageKey: string
  status: QueueItem['status']
  taxonomy: Option[]
  busy?: boolean
  onOutcome: (outcome: CallOutcome) => void
  onStageChange: (stageKey: string) => void
  onStatusChange: (status: QueueItem['status']) => void
  onFollowUpChange: (dateIso: string | null) => void
  onSaveNote: (note: string) => void
  onObjection: (taxonomyKey: string) => void
}

const OUTCOMES: { value: CallOutcome; label: string }[] = [
  { value: 'closed', label: 'Closed' },
  { value: 'progressing', label: 'Progressing' },
  { value: 'objection', label: 'Objection' },
  { value: 'no_answer', label: 'No answer' },
  { value: 'callback', label: 'Callback' },
]

const OUTCOME_TONE: Record<CallOutcome, string> = {
  closed: 'border-success bg-success-subtle text-success hover:border-success',
  progressing: 'border-accent bg-accent-subtle text-accent hover:border-accent',
  objection: 'border-danger bg-danger-subtle text-danger hover:border-danger',
  no_answer: 'border-border-strong bg-surface text-fg-muted hover:bg-surface-sunk',
  callback: 'border-border-strong bg-surface text-fg hover:bg-surface-sunk',
}

const STATUSES: QueueItem['status'][] = ['open', 'won', 'lost']

const selectClass =
  'h-10 w-full rounded-md border border-border bg-surface-raised px-2.5 text-sm text-fg shadow-[var(--inset-highlight)] hover:border-border-strong focus:bg-surface disabled:cursor-not-allowed disabled:opacity-60'

export function OutcomeBar({
  stages,
  stageKey,
  status,
  taxonomy,
  busy = false,
  onOutcome,
  onStageChange,
  onStatusChange,
  onFollowUpChange,
  onSaveNote,
  onObjection,
}: Props) {
  const [followUp, setFollowUp] = useState('')
  const [note, setNote] = useState('')
  const [objectionKey, setObjectionKey] = useState('')

  return (
    <div className="space-y-3 px-3 py-3">
      <div role="group" aria-label="Log outcome">
        <h3 className="label-caps mb-1.5">Call outcome</h3>
        <div className="grid grid-cols-3 gap-2">
          {OUTCOMES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              data-outcome={value}
              disabled={busy}
              onClick={() => onOutcome(value)}
              className={[
                'min-h-10 rounded-md border px-2 text-xs font-semibold transition-colors select-none disabled:opacity-45',
                OUTCOME_TONE[value],
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="label-caps mb-1 block">Stage</span>
          <select value={stageKey} disabled={busy} onChange={(e) => onStageChange(e.target.value)} className={selectClass} aria-label="Stage">
            {stages.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label-caps mb-1 block">Status</span>
          <select value={status} disabled={busy} onChange={(e) => onStatusChange(e.target.value as QueueItem['status'])} className={selectClass} aria-label="Status">
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block">
        <span className="label-caps mb-1 block">Follow-up</span>
        <span className="flex items-center gap-2">
          <input
            type="date"
            value={followUp}
            disabled={busy}
            onChange={(e) => {
              setFollowUp(e.target.value)
              onFollowUpChange(e.target.value || null)
            }}
            className={[selectClass, 'tnum'].join(' ')}
            aria-label="Follow-up date"
          />
          {followUp && (
            <Button variant="ghost" size="sm" onClick={() => { setFollowUp(''); onFollowUpChange(null) }}>
              Clear
            </Button>
          )}
        </span>
      </label>

      <div>
        <span className="label-caps mb-1 block">Note</span>
        <textarea
          value={note}
          disabled={busy}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="What happened on the call…"
          aria-label="Note"
          className="w-full resize-none rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-fg shadow-[var(--inset-highlight)] placeholder:text-fg-subtle hover:border-border-strong focus:bg-surface disabled:opacity-60"
        />
        <Button variant="secondary" size="sm" className="mt-1.5" disabled={busy || note.trim() === ''} onClick={() => { onSaveNote(note.trim()); setNote('') }}>
          Save note
        </Button>
      </div>

      <div>
        <span className="label-caps mb-1 block">Log an objection</span>
        <span className="flex items-center gap-2">
          <select value={objectionKey} disabled={busy} onChange={(e) => setObjectionKey(e.target.value)} className={selectClass} aria-label="Objection type">
            <option value="">Pick…</option>
            {taxonomy.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
          <Button
            variant="secondary"
            size="sm"
            disabled={busy || objectionKey === ''}
            onClick={() => { onObjection(objectionKey); setObjectionKey('') }}
          >
            Log
          </Button>
        </span>
      </div>
    </div>
  )
}
