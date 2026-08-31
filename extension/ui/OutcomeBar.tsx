import { useEffect, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ChevronDown, CircleCheck, Clock3, PhoneMissed, ShieldAlert, SlidersHorizontal, TrendingUp } from 'lucide-react'
import type { CallOutcome, QueueItem } from '../lib/contracts'
import { Button } from '../../src/ui/Button'

export type Option = { key: string; label: string }

type Props = {
  stages: Option[]
  stageKey: string
  status: QueueItem['status']
  taxonomy: Option[]
  busy?: boolean
  onOutcome: (outcome: CallOutcome, taxonomyKey?: string) => void
  onStageChange: (stageKey: string) => void
  onStatusChange: (status: QueueItem['status']) => void
  onFollowUpChange: (dateIso: string | null) => void
  onSaveNote: (note: string) => void
  onObjection: (taxonomyKey: string) => void
}

// Rank, not a five-across row of equals. Rows 1 and 2 are the same frozen
// CallOutcome order (closed → callback), so DOM order still equals tab order —
// the hierarchy is carried by size and tone instead of by re-sorting focus.
//   Row 1 "the call connected and something happened": tall, tinted, the ones
//   worth a deliberate press mid-conversation.
//   Row 2 "nothing happened": shorter, neutral, the reflex taps.
const CONNECTED: { value: CallOutcome; label: string; icon: LucideIcon; tone: string }[] = [
  { value: 'closed', label: 'Closed', icon: CircleCheck, tone: 'border-success bg-success-subtle text-success hover:border-success' },
  { value: 'progressing', label: 'Progressing', icon: TrendingUp, tone: 'border-accent bg-accent-subtle text-accent hover:border-accent' },
  { value: 'objection', label: 'Objection', icon: ShieldAlert, tone: 'border-danger bg-danger-subtle text-danger hover:border-danger' },
]

const UNCONNECTED: { value: CallOutcome; label: string; icon: LucideIcon }[] = [
  { value: 'no_answer', label: 'No answer', icon: PhoneMissed },
  { value: 'callback', label: 'Callback', icon: Clock3 },
]

const STATUSES: QueueItem['status'][] = ['open', 'won', 'lost']

const selectClass =
  'h-11 w-full rounded-md border border-border bg-surface-raised px-2.5 text-sm text-fg shadow-[var(--inset-highlight)] hover:border-border-strong focus:bg-surface disabled:cursor-not-allowed disabled:opacity-60'

// summary is not in the global :focus-visible selector list, so it carries its
// own ring — same accent + offset, straight off the tokens.
const summaryClass =
  'flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-md px-3 text-xs font-semibold text-fg-muted select-none hover:bg-surface-sunk hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent [&::-webkit-details-marker]:hidden'

/** Local dates only: an ISO string here would drift a day across timezones. */
function dayOffset(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const QUICK_DAYS: { label: string; days: number }[] = [
  { label: 'Today', days: 0 },
  { label: 'Tomorrow', days: 1 },
  { label: 'In 3 days', days: 3 },
  { label: 'Next week', days: 7 },
]

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
  const [objectionKey, setObjectionKey] = useState(taxonomy[0]?.key ?? '')

  useEffect(() => {
    if (!objectionKey && taxonomy[0]) setObjectionKey(taxonomy[0].key)
  }, [objectionKey, taxonomy])

  function pickFollowUp(value: string) {
    setFollowUp(value)
    onFollowUpChange(value || null)
  }

  return (
    <div className="space-y-3.5 px-3 py-3">
      <div role="group" aria-label="Log outcome">
        <h3 className="label-caps mb-1.5">Call outcome</h3>
        <div className="grid grid-cols-3 gap-2">
          {CONNECTED.map(({ value, label, icon: Icon, tone }) => (
            <button
              key={value}
              type="button"
              data-outcome={value}
              disabled={busy}
              onClick={() => (value === 'objection' ? onOutcome(value, objectionKey || undefined) : onOutcome(value))}
              className={[
                'flex min-h-14 flex-col items-center justify-center gap-1 rounded-md border px-1 text-xs font-semibold transition-colors select-none disabled:opacity-45',
                tone,
              ].join(' ')}
            >
              <Icon aria-hidden size={17} strokeWidth={1.9} />
              <span className="leading-none">{label}</span>
            </button>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {UNCONNECTED.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              data-outcome={value}
              disabled={busy}
              onClick={() => onOutcome(value)}
              className="flex min-h-11 items-center justify-center gap-1.5 rounded-md border border-border bg-surface-sunk px-2 text-xs font-medium text-fg-muted transition-colors select-none hover:border-border-strong hover:text-fg disabled:opacity-45"
            >
              <Icon aria-hidden size={15} strokeWidth={1.75} />
              {label}
            </button>
          ))}
        </div>
        {/* Sits directly under Objection because that button reads this value —
            a dependency two screens apart is a dependency nobody can see. */}
        <div className="mt-2 flex items-center gap-2">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Objection type</span>
            <select
              value={objectionKey}
              disabled={busy}
              onChange={(e) => setObjectionKey(e.target.value)}
              className={selectClass}
              aria-label="Objection type"
            >
              <option value="">Objection type…</option>
              {taxonomy.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <Button
            variant="secondary"
            className="min-h-11"
            disabled={busy || objectionKey === ''}
            onClick={() => {
              onObjection(objectionKey)
              setObjectionKey('')
            }}
          >
            Log
          </Button>
        </div>
      </div>

      <div>
        <h3 className="label-caps mb-1.5">Follow-up</h3>
        {/* Typing dd/mm/yyyy mid-call is a form. One tap on "Tomorrow" is a tool;
            the native picker stays for the dates that are neither. */}
        <div className="flex flex-wrap gap-1.5">
          {QUICK_DAYS.map(({ label, days }) => {
            const value = dayOffset(days)
            const active = followUp === value
            return (
              <button
                key={label}
                type="button"
                disabled={busy}
                aria-pressed={active}
                onClick={() => pickFollowUp(active ? '' : value)}
                className={[
                  'min-h-9 rounded-pill border px-3 text-xs font-medium transition-colors select-none disabled:opacity-45',
                  active
                    ? 'border-accent bg-accent-subtle text-accent'
                    : 'border-border bg-surface-raised text-fg-muted hover:border-border-strong hover:text-fg',
                ].join(' ')}
              >
                {label}
              </button>
            )
          })}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <input
            type="date"
            value={followUp}
            disabled={busy}
            onChange={(e) => pickFollowUp(e.target.value)}
            className={[selectClass, 'tnum'].join(' ')}
            aria-label="Follow-up date"
          />
          {followUp && (
            <Button variant="ghost" className="min-h-11" disabled={busy} onClick={() => pickFollowUp('')}>
              Clear
            </Button>
          )}
        </div>
      </div>

      <div>
        <h3 className="label-caps mb-1.5">Note</h3>
        <textarea
          value={note}
          disabled={busy}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="What happened on the call…"
          aria-label="Note"
          className="w-full resize-none rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-fg shadow-[var(--inset-highlight)] placeholder:text-fg-subtle hover:border-border-strong focus:bg-surface disabled:opacity-60"
        />
        <Button
          variant="secondary"
          className="mt-1.5 min-h-11 w-full"
          disabled={busy || note.trim() === ''}
          onClick={() => {
            onSaveNote(note.trim())
            setNote('')
          }}
        >
          Save note
        </Button>
      </div>

      {/* Stage and status are edited a few times a week, not a few times a
          call. Collapsed so they stop competing with the outcome grid. */}
      <details className="group rounded-md border border-border bg-surface">
        <summary className={summaryClass}>
          <SlidersHorizontal aria-hidden size={14} strokeWidth={1.9} />
          Stage &amp; status
          <ChevronDown aria-hidden size={14} className="ml-auto transition-transform group-open:rotate-180" />
        </summary>
        <div className="grid grid-cols-2 gap-2 border-t border-border p-3">
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
            <select
              value={status}
              disabled={busy}
              onChange={(e) => onStatusChange(e.target.value as QueueItem['status'])}
              className={selectClass}
              aria-label="Status"
            >
              {STATUSES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </div>
      </details>
    </div>
  )
}
