import type { QueueItem } from '../../lib/inbox-data'
import { waitStamp, urgency } from '../../lib/wait'
import { Avatar } from '../../ui/Avatar'
import { ChannelIcon } from '../../ui/ChannelIcon'

// A queue row, SA-06 shape — Joyal's direct spec (2026-07-30, supersedes the
// §1.5 wait-time-largest inversion): the CUSTOMER (name or number) is the
// heading, the last message sits under it small, and the wait time is small
// on the right. Urgency still reads at arm's length through the phone spine
// colour and the stamp's tone — it just no longer shouts over the name.

const SPINE: Record<ReturnType<typeof urgency>, string> = {
  calm: 'bg-border',
  warm: 'bg-fg-subtle',
  late: 'bg-danger',
}

const STAMP: Record<ReturnType<typeof urgency>, string> = {
  calm: 'text-fg-subtle',
  warm: 'text-fg-muted',
  late: 'text-danger',
}

const capsStyle = {
  fontWeight: 'var(--weight-caps)',
  letterSpacing: 'var(--tracking-caps)',
} as const

export function QueueRow({
  item,
  preview,
  selected,
  onSelect,
  assigneeLabel,
}: {
  item: QueueItem
  preview: string
  selected: boolean
  onSelect: () => void
  /** SA-06: who this chat is labeled under — "You", a teammate's name, or
   *  null for unlabeled. Resolved by the parent (it owns the roster). */
  assigneeLabel?: string | null
}) {
  const level = urgency(item.last_customer_message_at)
  const stamp = waitStamp(item.last_customer_message_at)
  const name = item.contact?.profile_name ?? item.contact?.external_id ?? 'Unknown contact'

  return (
    <button
      onClick={onSelect}
      aria-current={selected ? 'true' : undefined}
      className={[
        'flex w-full items-stretch gap-0 border-b border-border text-left transition-colors',
        selected ? 'bg-accent-subtle' : 'bg-surface hover:bg-surface-sunk active:bg-surface-sunk',
      ].join(' ')}
    >
      {/* The 4px urgency spine — colour still carries "how long", quietly. */}
      <span
        aria-hidden
        className={['shrink-0', SPINE[level]].join(' ')}
        style={{ width: 'var(--spine-w)' }}
      />

      <div className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pr-3 pl-3">
        <Avatar name={name} profile={item.contact?.profile} size="md" />

        <div className="min-w-0 flex-1">
          {/* Heading: the customer. */}
          <div className="flex items-baseline gap-2">
            <span
              className={[
                'min-w-0 flex-1 truncate text-sm text-fg',
                item.unread_count > 0 ? 'font-semibold' : 'font-medium',
              ].join(' ')}
            >
              {name}
            </span>
            <ChannelIcon channel={item.contact?.channel ?? null} size={13} />
            {/* Time: small, mono, right. */}
            <span
              className={['tnum shrink-0 text-xs leading-none', STAMP[level]].join(' ')}
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              {stamp}
            </span>
          </div>

          {/* Previous message: small, one line. */}
          <div className="mt-0.5 flex items-center gap-2">
            <span
              className={[
                'min-w-0 flex-1 truncate text-xs',
                item.unread_count > 0 ? 'text-fg-muted' : 'text-fg-subtle',
              ].join(' ')}
            >
              {preview}
            </span>
            {/* Right-edge metadata is capped at TWO chips (audit A16): paused
                state > assignee > unread count. Three stacked chips collided
                with the preview at 390px. */}
            {assigneeLabel && !(item.bot_paused && item.unread_count > 0) && (
              <span
                className={[
                  'shrink-0 text-2xs uppercase',
                  assigneeLabel === 'You' ? 'text-accent' : 'text-fg-subtle',
                ].join(' ')}
                style={capsStyle}
              >
                {assigneeLabel}
              </span>
            )}
            {item.bot_paused && (
              <span className="shrink-0 text-2xs text-warn uppercase" style={capsStyle}>
                {item.escalation_resolved ? 'Bot paused' : 'Needs human'}
              </span>
            )}
            {item.unread_count > 0 && (
              <span
                className="tnum shrink-0 rounded-pill bg-accent-subtle px-1.5 text-2xs font-semibold text-accent"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {item.unread_count}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}
