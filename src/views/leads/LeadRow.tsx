import type { LeadItem, LeadStage, FollowUpItem } from '../../lib/leads-data'
import { waitStamp, urgency } from '../../lib/wait'

// A lead row is the SAME departure-board aesthetic as QueueRow (amendment
// item 1) with one inversion: Inbox leads with the message, Leads leads with
// the PERSON and what is stuck (§S4 THE WORK) — the name is the decision
// here, not the recall. Time-in-stage takes wait-time's place in the gutter,
// fed by `updated_at` (the `leads_touch` trigger bumps it on every stage
// move, so it is a correct proxy without a new column).

const GUTTER_TONE: Record<ReturnType<typeof urgency>, string> = {
  calm: 'text-fg-subtle',
  warm: 'text-fg-muted',
  late: 'text-fg',
}

type FollowUpBucket = 'overdue' | 'today' | 'tomorrow' | null

function followUpBucket(dueAt: string, now: number = Date.now()): FollowUpBucket {
  const due = new Date(dueAt).getTime()
  if (!Number.isFinite(due)) return null
  if (due < now) return 'overdue'
  const d = new Date(due)
  const today = new Date(now)
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  if (sameDay(d, today)) return 'today'
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (sameDay(d, tomorrow)) return 'tomorrow'
  return null
}

const FOLLOW_UP_LABEL: Record<Exclude<FollowUpBucket, null>, string> = {
  overdue: 'Overdue',
  today: 'Due today',
  tomorrow: 'Due tomorrow',
}

/** What is stuck (§S4 THE WORK) — derived, degrades to a dash rather than an
 *  empty line when nothing is recorded. Never invents a placeholder. */
function stuckText(lead: LeadItem): string {
  if (lead.status === 'lost') return lead.lost_reason ? `Lost — ${lead.lost_reason}` : 'Lost'
  if (lead.status === 'won') return 'Won'
  if (lead.objection) return lead.objection
  if (lead.next_action) return lead.next_action
  return '—'
}

const capsStyle = {
  fontWeight: 'var(--weight-caps)',
  letterSpacing: 'var(--tracking-caps)',
} as const

export function LeadRow({
  lead,
  stage,
  stages,
  followUp,
  canEditStage,
  onStageChange,
}: {
  lead: LeadItem
  stage: LeadStage | null
  stages: LeadStage[]
  followUp: FollowUpItem | undefined
  canEditStage: boolean
  onStageChange: (stageId: string) => void
}) {
  const level = urgency(lead.updated_at)
  const stamp = waitStamp(lead.updated_at)
  const name = lead.contact?.profile_name ?? lead.contact?.external_id ?? 'Unknown contact'
  const channel = lead.contact?.channel === 'instagram' ? 'IG' : 'WA'
  const bucket = followUp ? followUpBucket(followUp.due_at) : null

  return (
    <div className="flex w-full items-stretch gap-0 border-b border-border bg-surface">
      {/* Phone: the 4px urgency spine — same rhythm as QueueRow, standing in
          for "how long has this sat here" rather than "how long has the
          customer waited". */}
      <span
        aria-hidden
        className={['shrink-0 sm:hidden', level === 'late' ? 'bg-fg-subtle' : 'bg-border'].join(' ')}
        style={{ width: 'var(--spine-w)' }}
      />

      {/* Desktop: the mono time-in-stage gutter. */}
      <div
        aria-hidden
        className="hidden shrink-0 flex-col items-end justify-center pr-3 pl-2 sm:flex"
        style={{ width: 'var(--gutter-w)' }}
      >
        <span
          className={['tnum text-xl leading-none', GUTTER_TONE[level]].join(' ')}
          style={{
            fontFamily: 'var(--font-mono)',
            fontWeight: 'var(--weight-num)',
            letterSpacing: 'var(--tracking-tight)',
          }}
        >
          {stamp}
        </span>
      </div>

      <div className="min-w-0 flex-1 py-3 pr-4 pl-3">
        {/* The person leads (§S4 THE WORK inverts Inbox's row hierarchy). */}
        <div className="flex items-baseline gap-2">
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">{name}</span>
          <span
            className="shrink-0 text-2xs text-fg-subtle uppercase"
            style={capsStyle}
            aria-label={channel === 'WA' ? 'WhatsApp' : 'Instagram'}
          >
            {channel}
          </span>
          {/* Phone-only inline stamp — the gutter's job at 4px. */}
          <span
            className={['tnum shrink-0 text-lg leading-none sm:hidden', GUTTER_TONE[level]].join(' ')}
            style={{
              fontFamily: 'var(--font-mono)',
              fontWeight: 'var(--weight-num)',
              letterSpacing: 'var(--tracking-tight)',
            }}
          >
            {stamp}
          </span>
        </div>

        {/* What is stuck — the line the rep actually reads. */}
        <div className="mt-1 truncate text-xs text-fg-muted">{stuckText(lead)}</div>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          {/* Stage as a micro-caps label (§1.6), not a coloured pill. Editable
              only when the RLS wall (proved empirically, not asserted) will
              actually accept the write — this select GRANTS nothing, it is a
              rendering convenience; Postgres decides on every submit. */}
          {canEditStage ? (
            <select
              value={lead.stage_id}
              onChange={(e) => onStageChange(e.target.value)}
              aria-label={`Stage for ${name}`}
              className="rounded-sm border border-transparent bg-transparent py-0.5 pr-1 text-2xs text-fg-subtle uppercase hover:border-border focus:border-border-strong"
              style={capsStyle}
            >
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-2xs text-fg-subtle uppercase" style={capsStyle}>
              {stage?.label ?? 'Unknown stage'}
            </span>
          )}

          {lead.temperature_override && (
            <span className="text-2xs text-fg-subtle uppercase" style={capsStyle}>
              {lead.temperature_override}
            </span>
          )}

          {lead.est_value != null && (
            <span className="tnum text-2xs text-fg-subtle">
              ₹{Number(lead.est_value).toLocaleString('en-IN')}
            </span>
          )}

          {/* Accent reserved for exactly one thing per screen (§1.7): the
              next action. An overdue follow-up is the closest thing this
              board has to "what to do next", so it is the one place danger
              earns its keep. */}
          {bucket && (
            <span
              className={['text-2xs uppercase', bucket === 'overdue' ? 'text-danger' : 'text-fg-subtle'].join(
                ' ',
              )}
              style={capsStyle}
            >
              {FOLLOW_UP_LABEL[bucket]}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
