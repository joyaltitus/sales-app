import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, Flame, MessageCircle } from 'lucide-react'
import { Button } from '../../ui/Button'
import { StatusBadge, SampleTag, EvidenceLink } from '../../ui/agent/primitives'
import {
  MOCK_ACTIONS,
  MOCK_PROGRESS,
  type NextAction,
  type ActionUrgency,
} from '../../lib/mock-wave3'

// Next-best-action feed (C-NBA shape, mock). The screen answers ONE question —
// "what do I do next" — with reasons and evidence, not pressure: urgency tops
// out at a calm "Now"; nothing blinks, nothing shames.

const URGENCY: Record<ActionUrgency, { label: string; tone: 'danger' | 'warn' | 'neutral' }> = {
  now: { label: 'Now', tone: 'danger' },
  today: { label: 'Today', tone: 'warn' },
  this_week: { label: 'This week', tone: 'neutral' },
}

function ActionCard({ a }: { a: NextAction }) {
  const [done, setDone] = useState<null | 'accepted' | 'dismissed'>(null)
  const [showReply, setShowReply] = useState(false)
  const u = URGENCY[a.urgency]

  if (done === 'dismissed') return null

  return (
    <article className="rounded-md border border-border bg-surface p-3.5 shadow-elev-1">
      <div className="flex items-center justify-between gap-2">
        <h4 className="min-w-0 truncate text-sm font-semibold text-fg">{a.customer}</h4>
        <span className="flex shrink-0 items-center gap-1.5">
          {a.due && (
            <span className="tnum text-2xs text-fg-muted" style={{ fontFamily: 'var(--font-mono)' }}>
              {a.due}
            </span>
          )}
          <StatusBadge tone={u.tone}>{u.label}</StatusBadge>
        </span>
      </div>

      <p className="mt-1.5 text-sm text-fg">{a.action}</p>
      <p className="mt-0.5 text-xs text-fg-muted">{a.why}</p>

      {a.brainContext && (
        <p className="mt-2 rounded-sm bg-surface-sunk px-2 py-1 text-2xs text-fg-muted">
          Memory: {a.brainContext}
        </p>
      )}
      {a.evidence && (
        <div className="mt-1.5">
          <EvidenceLink quote={a.evidence.replace(/^"|"$/g, '')} />
        </div>
      )}

      {a.suggestedReply && showReply && (
        <p className="mt-2 rounded-sm border border-accent-subtle bg-accent-subtle px-2.5 py-2 text-xs text-fg">
          {a.suggestedReply}
        </p>
      )}

      {done === 'accepted' ? (
        <p className="mt-3 text-xs font-medium text-success" role="status">
          On it — opened the conversation.
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => setDone('accepted')}>
            {a.suggestedReply ? 'Use reply' : 'Accept'}
          </Button>
          {a.suggestedReply && (
            <Button size="sm" variant="ghost" onClick={() => setShowReply((v) => !v)}>
              {showReply ? 'Hide draft' : 'See draft'}
            </Button>
          )}
          <Link
            to="/inbox"
            className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-fg-muted hover:bg-surface-sunk hover:text-fg"
          >
            <MessageCircle aria-hidden size={13} />
            Open conversation
          </Link>
          <Button size="sm" variant="ghost" onClick={() => setDone('dismissed')}>
            Dismiss
          </Button>
        </div>
      )}
    </article>
  )
}

export function ActionFeed() {
  const now = MOCK_ACTIONS.filter((a) => a.urgency === 'now')
  const later = MOCK_ACTIONS.filter((a) => a.urgency !== 'now')

  return (
    <div className="space-y-3 px-4 py-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-fg">Next best actions</h3>
        <SampleTag label="Preview — not wired" />
      </div>

      {now.map((a) => (
        <ActionCard key={a.id} a={a} />
      ))}
      {later.map((a) => (
        <ActionCard key={a.id} a={a} />
      ))}

      {/* Healthy momentum — personal, factual, no leaderboard shame */}
      <div className="rounded-md border border-border bg-surface-raised p-3.5 shadow-elev-1">
        <div className="flex items-center justify-between">
          <h4 className="label-caps">Your day</h4>
          <span className="flex items-center gap-1 text-2xs font-semibold text-accent">
            <Flame aria-hidden size={12} />
            {MOCK_PROGRESS.streakDays}-day follow-up streak
          </span>
        </div>
        <div className="tnum mt-2 grid grid-cols-3 gap-2 text-center">
          {(
            [
              ['Replies', String(MOCK_PROGRESS.repliesToday)],
              ['Follow-ups', `${MOCK_PROGRESS.followUpsDone}/${MOCK_PROGRESS.followUpsPlanned}`],
              ['Team visits', `${MOCK_PROGRESS.teamGoal.done}/${MOCK_PROGRESS.teamGoal.target}`],
            ] as const
          ).map(([l, v]) => (
            <div key={l} className="rounded-sm bg-surface-sunk px-2 py-2">
              <div className="text-md leading-none font-semibold text-fg" style={{ fontFamily: 'var(--font-mono)' }}>
                {v}
              </div>
              <div className="label-caps mt-1">{l}</div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-2xs text-fg-muted">{MOCK_PROGRESS.responseTrend}</p>
        <p className="mt-1 flex items-center gap-1.5 text-2xs text-fg-muted">
          <CalendarClock aria-hidden size={12} className="shrink-0" />
          {MOCK_PROGRESS.recognition}
        </p>
      </div>
    </div>
  )
}
