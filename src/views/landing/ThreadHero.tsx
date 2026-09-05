import { useNavigate } from 'react-router-dom'
import type { QueueItem } from '../../lib/inbox-data'
import { waitStamp, urgency } from '../../lib/wait'
import { useRolePath } from '../../shell/RoleRouter'

// Today's lead element (§1.11): the oldest unanswered thread, full-width and
// tappable. Not a card in a grid of cards — the whole point is that a rep
// opening the app is looking at exactly one thing to do next.
//
// Same type hierarchy as the queue row (§1.5), turned up: the WAIT is the
// largest thing on the screen, the message is what you read, the name is
// recall and sits last. Urgency is weight and the neutral scale until it
// crosses `late`, at which point danger appears and means something (§1.7).

const TONE: Record<ReturnType<typeof urgency>, string> = {
  calm: 'text-fg-muted',
  warm: 'text-fg',
  late: 'text-danger',
}

export function ThreadHero({ item, preview }: { item: QueueItem; preview: string }) {
  const navigate = useNavigate()
  const rolePath = useRolePath()
  const level = urgency(item.last_customer_message_at)
  const stamp = waitStamp(item.last_customer_message_at)
  const name = item.contact?.profile_name ?? item.contact?.external_id ?? 'Unknown contact'
  const channel = item.contact?.channel === 'instagram' ? 'Instagram' : 'WhatsApp'

  return (
    <button
      onClick={() => navigate(rolePath(`/inbox?c=${item.id}`))}
      className="block w-full border-b border-border bg-surface px-4 py-5 text-left transition-colors hover:bg-surface-sunk active:bg-surface-sunk"
    >
      <div className="flex items-start gap-4">
        <span
          className={['tnum shrink-0 leading-none', TONE[level]].join(' ')}
          style={{
            fontFamily: 'var(--font-mono)',
            fontWeight: 'var(--weight-num)',
            letterSpacing: 'var(--tracking-tight)',
            fontSize: 'clamp(2.25rem, 12vw, 3.25rem)',
          }}
        >
          {stamp}
        </span>
        <div className="min-w-0 flex-1 pt-1">
          <p className="line-clamp-3 text-sm font-medium text-fg">{preview}</p>
          <div className="mt-2 flex items-center gap-2">
            <span className="truncate text-xs text-fg-subtle">{name}</span>
            <span className="shrink-0 text-2xs font-medium text-fg-subtle">
              {channel === 'WhatsApp' ? 'WA' : 'IG'}
            </span>
            {item.bot_paused && (
              <span className="shrink-0 text-2xs font-medium text-warn">
                Bot paused
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}
