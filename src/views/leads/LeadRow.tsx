import { useRef, useState } from 'react'
import type { LeadItem, LeadStage, FollowUpItem } from '../../lib/leads-data'
import { waitStamp, urgency } from '../../lib/wait'
import { AssignSelect } from '../crm/MockControls'
import { Link } from 'react-router-dom'
import { ChevronRight, MessageCircle, MoreHorizontal } from 'lucide-react'
import { Avatar } from '../../ui/Avatar'
import { ChannelIcon } from '../../ui/ChannelIcon'
import { CallButton } from '../calls/CallButton'
import { DealProbability, estimateDealProbability } from '../revenue/DealProbability'
import { NextAction } from '../../ui/NextAction'
import { formatINR } from '../../ui/formatMoney'
import { LeadQuickActions } from './LeadQuickActions'

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
  crm = false,
}: {
  lead: LeadItem
  stage: LeadStage | null
  stages: LeadStage[]
  followUp: FollowUpItem | undefined
  canEditStage: boolean
  onStageChange: (stageId: string) => void
  /** SA-04: CRM pipeline mounts add the SAMPLE assignment/objection controls
   *  (Wave-1 backlog, unwired). The rep board never sets this. */
  crm?: boolean
}) {
  const [quickOpen, setQuickOpen] = useState(false)
  const [captureOpen, setCaptureOpen] = useState(false)
  const holdTimer = useRef<number | null>(null)
  const level = urgency(lead.updated_at)
  const stamp = waitStamp(lead.updated_at)
  const name = lead.contact?.profile_name ?? lead.contact?.external_id ?? 'Unknown contact'
  const bucket = followUp ? followUpBucket(followUp.due_at) : null

  return (
    <div
      onContextMenu={(event) => { event.preventDefault(); setQuickOpen(true) }}
      onPointerDown={(event) => { if (event.pointerType === 'touch') holdTimer.current = window.setTimeout(() => setQuickOpen(true), 520) }}
      onPointerUp={() => { if (holdTimer.current) window.clearTimeout(holdTimer.current) }}
      onPointerCancel={() => { if (holdTimer.current) window.clearTimeout(holdTimer.current) }}
      className="m-3 flex min-h-[132px] w-[calc(100%_-_1.5rem)] items-stretch gap-0 overflow-hidden rounded-lg border border-border bg-surface shadow-elev-1 sm:m-0 sm:min-h-0 sm:w-full sm:rounded-none sm:border-x-0 sm:border-t-0 sm:shadow-none"
    >
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

      <div className="min-w-0 flex-1 p-4 sm:py-3 sm:pr-4 sm:pl-3">
        {/* The person leads (§S4 THE WORK inverts Inbox's row hierarchy). */}
        <div className="flex items-center gap-2">
          <span className="sm:hidden"><Avatar name={name} size="sm" /></span>
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">{name}</span>
          <ChannelIcon channel={lead.contact?.channel ?? null} size={13} />
          <DealProbability probability={estimateDealProbability(lead, stages)} person={name} />
          <button onClick={(event) => { event.stopPropagation(); setQuickOpen(true) }} aria-label={`Quick actions for ${name}`} className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-fg-subtle hover:bg-surface-sunk hover:text-fg"><MoreHorizontal aria-hidden size={15} /></button>
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
        <div className="mt-2"><NextAction compact label={lead.next_action || 'Call and confirm the decision'} detail={lead.objection ? `Resolve ${lead.objection}` : undefined} /></div>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          {/* Stage as a micro-caps label (§1.6), not a coloured pill. Editable
              only when the RLS wall (proved empirically, not asserted) will
              actually accept the write — this select GRANTS nothing, it is a
              rendering convenience; Postgres decides on every submit. */}
          {canEditStage ? (
            <select
              value={lead.stage_id}
              onClick={(e) => e.stopPropagation()}
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
              {formatINR(Number(lead.est_value))}
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

          {/* SA-04 SAMPLE controls (CRM mounts only): assignment + objection
              capture from the Wave-1 backlog. Dashed border = not wired; they
              hold state for the session and write nowhere. */}
          {crm && (
            <span className="ml-auto flex shrink-0 items-center gap-2">
              <CallButton person={name} phone={lead.contact?.external_id} dealValue={Number(lead.est_value ?? 60000)} variant="icon" contactId={lead.contact_id} leadId={lead.id} conversationId={lead.conversation_id} />
              <AssignSelect leadName={name} />
            </span>
          )}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-3 sm:hidden">
          {lead.conversation_id ? (
            <Link
              to={`/inbox?c=${encodeURIComponent(lead.conversation_id)}`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-md border border-border text-xs font-semibold text-fg-muted hover:border-border-strong hover:text-fg"
            >
              <MessageCircle aria-hidden size={14} /> Message
            </Link>
          ) : <span />}
          <CallButton person={name} phone={lead.contact?.external_id} dealValue={Number(lead.est_value ?? 60000)} contactId={lead.contact_id} leadId={lead.id} conversationId={lead.conversation_id} />
          {canEditStage && stages.findIndex((item) => item.id === lead.stage_id) < stages.length - 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                const index = stages.findIndex((item) => item.id === lead.stage_id)
                const next = stages[index + 1]
                if (next) onStageChange(next.id)
              }}
              className="inline-flex min-h-10 items-center justify-center gap-1 rounded-md bg-accent-subtle text-xs font-semibold text-accent hover:bg-accent-soft"
            >
              Advance <ChevronRight aria-hidden size={14} />
            </button>
          )}
        </div>

        <LeadQuickActions open={quickOpen} onClose={() => { setQuickOpen(false); setCaptureOpen(false) }} person={name} phone={lead.contact?.external_id} dealValue={Number(lead.est_value ?? 60000)} conversationId={lead.conversation_id} contactId={lead.contact_id} captureOpen={captureOpen} onCaptureToggle={() => setCaptureOpen((value) => !value)} />
      </div>
    </div>
  )
}
