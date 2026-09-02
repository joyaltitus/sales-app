import { useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { CircleCheck, Clock3, PhoneMissed, ShieldAlert, TrendingUp } from 'lucide-react'
import type { CallOutcome } from '../lib/contracts'

export type Option = { key: string; label: string }

type Props = {
  taxonomy: Option[]
  busy?: boolean
  onOutcome: (outcome: CallOutcome, taxonomyKey?: string) => void
  onFollowUpChange: (dateIso: string | null) => void
}

// Rank, not a five-across row of equals, and the frozen CallOutcome order —
// so DOM order still equals tab order.
//   Large: the call connected and something happened.
//   Small: nothing happened; the reflex taps.
const CONNECTED: { value: CallOutcome; label: string; icon: LucideIcon; tone: string }[] = [
  { value: 'closed', label: 'Closed', icon: CircleCheck, tone: 'border-success bg-success-subtle text-success' },
  { value: 'progressing', label: 'Progressing', icon: TrendingUp, tone: 'border-accent bg-accent-subtle text-accent' },
  { value: 'objection', label: 'Objection', icon: ShieldAlert, tone: 'border-danger bg-danger-subtle text-danger' },
]

const UNCONNECTED: { value: CallOutcome; label: string; icon: LucideIcon }[] = [
  { value: 'no_answer', label: 'No answer', icon: PhoneMissed },
  { value: 'callback', label: 'Callback', icon: Clock3 },
]

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

/**
 * Logging the call, in one tap.
 *
 * This replaces a 268-line form. A rep who has just hung up is holding a phone
 * and a thought, not filling a record: every outcome is one press, and the
 * follow-up is one more press directly beneath it — no date to type, no note to
 * compose, no stage and status selects competing with the thing that matters.
 *
 * The five CallOutcome values all survive; only their weight differs. Notes
 * live in Save conversation and the voice note above this; stage and status are
 * a CRM edit, not a post-call reflex.
 */
export function OutcomeTap({ taxonomy, busy = false, onOutcome, onFollowUpChange }: Props) {
  // Pre-selected, so Objection is genuinely ONE tap. A rep who means a different
  // type changes it first; a rep in a hurry still logs a true objection row.
  const [objectionKey, setObjectionKey] = useState(taxonomy[0]?.key ?? '')
  const [followUp, setFollowUp] = useState('')

  return (
    <div className="space-y-2.5 px-3 py-3">
      <div role="group" aria-label="Log outcome">
        <h3 className="label-caps mb-1.5">Call outcome</h3>
        <div className="grid grid-cols-3 gap-2">
          {CONNECTED.map(({ value, label, icon: Icon, tone }) => (
            <button
              key={value}
              type="button"
              data-outcome={value}
              disabled={busy}
              onClick={() => onOutcome(value, value === 'objection' ? objectionKey || undefined : undefined)}
              className={['flex min-h-16 flex-col items-center justify-center gap-1 rounded-md border px-1 text-sm font-semibold transition-colors select-none disabled:opacity-45', tone].join(' ')}
            >
              <Icon aria-hidden size={20} strokeWidth={1.9} />
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
        <label className="mt-2 block">
          <span className="sr-only">Objection type</span>
          <select
            value={objectionKey}
            disabled={busy}
            onChange={(e) => setObjectionKey(e.target.value)}
            aria-label="Objection type"
            className="h-11 w-full rounded-md border border-border bg-surface-raised px-2.5 text-sm text-fg hover:border-border-strong focus:bg-surface disabled:opacity-60"
          >
            {taxonomy.map((option) => (
              <option key={option.key} value={option.key}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>

      {/* One tap from the outcome, in the same glance. Typing dd/mm/yyyy after a
          call is a form; four dates cover the calls that get one. */}
      <div>
        <h3 className="label-caps mb-1.5">Follow-up</h3>
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
                onClick={() => {
                  const next = active ? '' : value
                  setFollowUp(next)
                  onFollowUpChange(next || null)
                }}
                className={[
                  'min-h-11 rounded-pill border px-3 text-sm font-medium transition-colors select-none disabled:opacity-45',
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
      </div>
    </div>
  )
}
