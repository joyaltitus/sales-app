import type { QueueItem } from '../../lib/inbox-data'
import { waitStamp, urgency } from '../../lib/wait'
import { Avatar } from '../../ui/Avatar'
import { ChannelIcon } from '../../ui/ChannelIcon'

// A queue row is a departure board row (§1.4): ordered by urgency, time in a
// fixed gutter, monospaced, dense, scannable at arm's length.
//
// Two things here are deliberate inversions of the CRM default, both from §1.5:
//   1. the WAIT TIME is the largest type on the row, larger than the name
//   2. the row leads with the LAST INBOUND MESSAGE TEXT, not the name
// The name is recall; the wait is the decision. Once the rep has chosen, the
// thread screen flips the hierarchy back and the name leads.
//
// Desktop gets the full 56px mono gutter (--gutter-w). On a 360px phone that is
// 15% of the screen — a real cost, not worth paying — so the gutter collapses to
// a 4px urgency spine (--spine-w) plus an inline mono stamp. Same rhythm, 4px.

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

export function QueueRow({
  item,
  preview,
  selected,
  onSelect,
}: {
  item: QueueItem
  preview: string
  selected: boolean
  onSelect: () => void
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
      {/* Phone: the 4px urgency spine. Hidden once the full gutter appears. */}
      <span
        aria-hidden
        className={['shrink-0 sm:hidden', SPINE[level]].join(' ')}
        style={{ width: 'var(--spine-w)' }}
      />

      {/* Desktop: the mono time gutter. The wait is the largest type on the row. */}
      <div
        aria-hidden
        className="hidden shrink-0 flex-col items-end justify-center pr-3 pl-2 sm:flex"
        style={{ width: 'var(--gutter-w)' }}
      >
        <span
          className={['tnum text-xl leading-none', STAMP[level]].join(' ')}
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
        {/* The message leads. This is the line the rep actually reads. */}
        <div className="flex items-baseline gap-2">
          <span
            className={[
              'min-w-0 flex-1 truncate text-sm',
              item.unread_count > 0 ? 'font-semibold text-fg' : 'font-normal text-fg-muted',
            ].join(' ')}
          >
            {preview}
          </span>
          {/* Phone-only inline stamp — the gutter's job at 4px. */}
          <span
            className={['tnum shrink-0 text-lg leading-none sm:hidden', STAMP[level]].join(' ')}
            style={{
              fontFamily: 'var(--font-mono)',
              fontWeight: 'var(--weight-num)',
              letterSpacing: 'var(--tracking-tight)',
            }}
          >
            {stamp}
          </span>
        </div>

        {/* The name is recall, so it sits second and small — now anchored by
            the avatar (SA-05, Joyal's ask; §1.10 #4 superseded for contacts). */}
        <div className="mt-1 flex items-center gap-2">
          <Avatar name={name} profile={item.contact?.profile} size="sm" />
          <span className="truncate text-xs text-fg-subtle">{name}</span>
          <ChannelIcon channel={item.contact?.channel ?? null} size={13} />
          {item.bot_paused && (
            <span
              className="ml-auto shrink-0 text-2xs text-warn uppercase"
              style={{ fontWeight: 'var(--weight-caps)', letterSpacing: 'var(--tracking-caps)' }}
            >
              Bot paused
            </span>
          )}
        </div>
      </div>
    </button>
  )
}
