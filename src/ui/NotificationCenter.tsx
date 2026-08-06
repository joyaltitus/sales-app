import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell,
  Award,
  Bot,
  CalendarCheck,
  Check,
  Clock3,
  MessageCircleMore,
  ListTodo,
  Flame,
  Target,
  UserPlus,
  Trophy,
  X,
} from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { useClient } from '../shell/ClientProvider'
import { markNotificationsRead, type NotificationRow, shortAge, useNotifications } from '../lib/notifications-data'

type NotificationKind = 'lead' | 'follow_up' | 'approval' | 'booking' | 'todo' | 'deal_won' | 'challenge' | 'badge' | 'streak'
type NotificationFilter = 'action' | 'updates' | 'all'

export type ProductNotificationPreview = {
  id: string
  kind: NotificationKind
  title: string
  detail: string
  time: string
  day: 'Today' | 'Yesterday'
  unread: boolean
  reactions?: { emoji: '👏' | '🔥' | '🎯'; count: number }[]
  reacted?: ('👏' | '🔥' | '🎯')[]
  sample: true
}

// S11: a live `notifications` row rendered in the same rail. Momentum/reaction
// rows above stay sample-tagged; these are real and carry the two things a tap
// needs — the thread to open and the AI draft to seed the composer with.
type LiveNotification = Omit<ProductNotificationPreview, 'sample'> & {
  sample: false
  conversationId: string | null
  draft: string | null
}

type RailItem = ProductNotificationPreview | LiveNotification

// Preview surface only. The report maps this shape to the future notification
// feed; local state makes read/unread behaviour reviewable without implying a
// persisted write.
const PREVIEW_NOTIFICATIONS: ProductNotificationPreview[] = [
  {
    id: 'n-win-1',
    kind: 'deal_won',
    title: 'Priya closed ₹2.4L',
    detail: 'Mumbai Clinic · annual wellness agreement.',
    time: 'Now',
    day: 'Today',
    unread: true,
    reactions: [{ emoji: '👏', count: 14 }, { emoji: '🔥', count: 6 }, { emoji: '🎯', count: 3 }],
    sample: true,
  },
  {
    id: 'n-badge-1',
    kind: 'badge',
    title: 'Asha earned Clear listener',
    detail: '10 useful objections captured this sprint.',
    time: '8m',
    day: 'Today',
    unread: true,
    reactions: [{ emoji: '👏', count: 7 }, { emoji: '🎯', count: 2 }],
    sample: true,
  },
  {
    id: 'n-challenge-1',
    kind: 'challenge',
    title: 'A cleaner follow-up week starts today',
    detail: 'Team challenge · build a week worth repeating.',
    time: '20m',
    day: 'Today',
    unread: true,
    reactions: [{ emoji: '🔥', count: 5 }, { emoji: '🎯', count: 4 }],
    sample: true,
  },
  {
    id: 'n-streak-1',
    kind: 'streak',
    title: 'One promise keeps your streak steady',
    detail: 'Complete the 4:00 pm callback before quiet hours. Two freezes remain.',
    time: '3h',
    day: 'Today',
    unread: true,
    sample: true,
  },
  {
    id: 'n-todo-1',
    kind: 'todo',
    title: 'Meera assigned you a todo',
    detail: 'Call Anjali before the fee deadline · due today at 4:30 pm.',
    time: 'Now',
    day: 'Today',
    unread: true,
    sample: true,
  },
  {
    id: 'n-todo-2',
    kind: 'todo',
    title: 'Assigned todo is overdue',
    detail: 'Send the parent reference to Rahul · open the attached conversation.',
    time: '12m',
    day: 'Today',
    unread: true,
    sample: true,
  },
  {
    id: 'n1',
    kind: 'approval',
    title: 'Agent needs a decision',
    detail: 'Approve Anjali’s two-instalment quotation.',
    time: '2m',
    day: 'Today',
    unread: true,
    sample: true,
  },
  {
    id: 'n2',
    kind: 'follow_up',
    title: 'Follow-up is overdue',
    detail: 'Vishnu K was promised a call at 6:00 pm.',
    time: '18m',
    day: 'Today',
    unread: true,
    sample: true,
  },
  {
    id: 'n3',
    kind: 'lead',
    title: 'New high-intent lead',
    detail: 'Fathima asked for the admission form twice.',
    time: '1h',
    day: 'Today',
    unread: true,
    sample: true,
  },
  {
    id: 'n4',
    kind: 'booking',
    title: 'Campus visit confirmed',
    detail: 'Rahul Das · tomorrow at 10:30 am.',
    time: 'Yesterday',
    day: 'Yesterday',
    unread: false,
    sample: true,
  },
  {
    id: 'n-challenge-end-1',
    kind: 'challenge',
    title: 'Team reached 93% on-time follow-ups',
    detail: 'Challenge complete · everyone improved against the prior sprint.',
    time: 'Yesterday',
    day: 'Yesterday',
    unread: false,
    reactions: [{ emoji: '👏', count: 19 }, { emoji: '🎯', count: 8 }],
    sample: true,
  },
]

const META = {
  lead: { icon: UserPlus, tone: 'text-info bg-info-subtle' },
  follow_up: { icon: Clock3, tone: 'text-warn bg-warn-subtle' },
  approval: { icon: Bot, tone: 'text-accent bg-accent-subtle' },
  booking: { icon: CalendarCheck, tone: 'text-success bg-success-subtle' },
  todo: { icon: ListTodo, tone: 'text-warn bg-warn-subtle' },
  deal_won: { icon: Trophy, tone: 'text-success bg-success-subtle' },
  challenge: { icon: Target, tone: 'text-accent bg-accent-subtle' },
  badge: { icon: Award, tone: 'text-success bg-success-subtle' },
  streak: { icon: Flame, tone: 'text-warn bg-warn-subtle' },
} as const

/** Live row → rail item. Kinds collapse onto the existing icon vocabulary. */
function toRailItem(row: NotificationRow, now: number): LiveNotification {
  const kind: NotificationKind =
    row.kind === 'labeled_to_you' ? 'lead' : row.kind === 'needs_human' ? 'approval' : 'follow_up'
  const ageMs = now - new Date(row.created_at).getTime()
  return {
    id: row.id,
    kind,
    title: row.title,
    detail: row.body ?? '',
    time: shortAge(row.created_at, now),
    day: ageMs < 24 * 60 * 60 * 1000 ? 'Today' : 'Yesterday',
    unread: row.read_at === null,
    sample: false,
    conversationId: row.conversation_id,
    draft: row.draft,
  }
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false)
  const [samples, setSamples] = useState(PREVIEW_NOTIFICATIONS)
  const [filter, setFilter] = useState<NotificationFilter>('action')
  const navigate = useNavigate()
  const { session } = useAuth()
  const { activeClient } = useClient()
  const { items: liveRows, reload } = useNotifications(activeClient?.id ?? null, session?.user.id ?? null)

  // Optimistic read state: the dot clears on tap, the DB write follows. A
  // failed write only means the badge returns on the next load.
  const [readLocally, setReadLocally] = useState<Set<string>>(() => new Set())
  const live = useMemo<LiveNotification[]>(() => {
    const now = Date.now()
    return liveRows.map((row) => {
      const item = toRailItem(row, now)
      return readLocally.has(item.id) ? { ...item, unread: false } : item
    })
  }, [liveRows, readLocally])
  const items = useMemo<RailItem[]>(() => [...live, ...samples], [live, samples])
  const unread = useMemo(() => items.filter((item) => item.unread).length, [items])
  const actionableKinds = useMemo(() => new Set<NotificationKind>(['lead', 'follow_up', 'approval', 'booking', 'todo']), [])
  const actionableUnread = useMemo(() => items.filter((item) => item.unread && actionableKinds.has(item.kind)).length, [items, actionableKinds])
  const visibleItems = useMemo(() => items.filter((item) => filter === 'all' || (filter === 'action' ? actionableKinds.has(item.kind) : !actionableKinds.has(item.kind))), [items, filter, actionableKinds])

  useEffect(() => {
    if (!open) return
    const close = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [open])

  const markVisibleRead = () => {
    const visibleIds = new Set(visibleItems.map((item) => item.id))
    setSamples((all) => all.map((item) => visibleIds.has(item.id) ? { ...item, unread: false } : item))
    const liveIds = live.filter((item) => item.unread && visibleIds.has(item.id)).map((item) => item.id)
    if (liveIds.length === 0) return
    setReadLocally((set) => new Set([...set, ...liveIds]))
    void markNotificationsRead(liveIds).then(reload)
  }

  /**
   * The S11 hand-off: tap a live nudge → the thread opens with the AI draft
   * already in the composer. The draft rides in router state rather than the
   * query string — it is prose, not an address, and the composer's own seed
   * path (SA-05) does the inserting. The human still edits and sends.
   */
  const openLive = (item: LiveNotification) => {
    if (item.unread) {
      setReadLocally((set) => new Set(set).add(item.id))
      void markNotificationsRead([item.id]).then(reload)
    }
    if (!item.conversationId) return
    setOpen(false)
    navigate(`/inbox?c=${encodeURIComponent(item.conversationId)}`, {
      state: item.draft ? { draft: item.draft } : undefined,
    })
  }

  const react = (id: string, emoji: '👏' | '🔥' | '🎯') => setSamples((all) => all.map((item) => {
    if (item.id !== id || item.reacted?.includes(emoji)) return item
    return { ...item, reacted: [...(item.reacted ?? []), emoji], reactions: item.reactions?.map((reaction) => reaction.emoji === emoji ? { ...reaction, count: reaction.count + 1 } : reaction) }
  }))

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative inline-flex h-11 w-11 items-center justify-center rounded-md border border-transparent text-fg-muted transition-colors hover:border-border hover:bg-surface-sunk hover:text-fg"
        aria-label={`${actionableUnread} unread notifications needing action, ${unread} unread total`}
      >
        <Bell aria-hidden size={17} strokeWidth={1.8} />
        {actionableUnread > 0 && (
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-pill border-2 border-surface bg-danger" />
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Notifications">
          <button
            className="sheet-overlay absolute inset-0 cursor-default bg-[var(--overlay)]"
            onClick={() => setOpen(false)}
            aria-label="Close notifications"
          />
          <aside className="sheet-panel absolute inset-y-0 right-0 flex w-full max-w-[420px] flex-col border-l border-border bg-surface shadow-elev-3">
            <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent-subtle text-accent">
                <MessageCircleMore aria-hidden size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-md font-semibold tracking-[-0.02em] text-fg">Notifications</h2>
                <p className="text-2xs text-fg-muted">{live.length ? `${live.length} live · recognition rows are preview` : 'Preview data · actions are not wired'}</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-md text-fg-muted hover:bg-surface-sunk hover:text-fg"
                aria-label="Close"
              >
                <X aria-hidden size={18} />
              </button>
            </header>

            <div className="grid grid-cols-3 gap-1 border-b border-border bg-surface px-4 py-2" role="tablist" aria-label="Notification type">
              {([
                { key: 'action', label: 'Needs action' },
                { key: 'updates', label: 'Updates' },
                { key: 'all', label: 'All' },
              ] as { key: NotificationFilter; label: string }[]).map((item) => <button key={item.key} role="tab" aria-selected={filter === item.key} onClick={() => setFilter(item.key)} className={['min-h-10 rounded-md px-2 text-2xs font-semibold', filter === item.key ? 'bg-accent-subtle text-accent' : 'text-fg-muted hover:bg-surface-sunk hover:text-fg'].join(' ')}>{item.label}</button>)}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {(['Today', 'Yesterday'] as const).map((day) => {
                const group = visibleItems.filter((item) => item.day === day)
                if (!group.length) return null
                return (
                  <section key={day} aria-labelledby={`notification-${day}`}>
                    <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface-glass px-5 py-2.5 backdrop-blur-xl">
                      <h3 id={`notification-${day}`} className="label-caps">{day}</h3>
                      {day === 'Today' && group.some((item) => item.unread) && (
                        <button onClick={markVisibleRead} className="min-h-9 text-2xs font-semibold text-accent hover:text-accent-hover">
                          Mark visible read
                        </button>
                      )}
                    </div>
                    {group.map((item) => {
                      const meta = META[item.kind]
                      const Icon = meta.icon
                      return (
                        <article
                          key={item.id}
                          className={['relative border-b border-border', item.unread ? 'bg-accent-subtle/35' : 'bg-surface'].join(' ')}
                        >
                          {item.unread && <span className="absolute top-7 left-1.5 h-1.5 w-1.5 rounded-pill bg-accent" />}
                        <button
                          onClick={() =>
                            item.sample
                              ? setSamples((all) =>
                                  all.map((row) => row.id === item.id ? { ...row, unread: false } : row),
                                )
                              : openLive(item)
                          }
                          className={[
                            'flex w-full gap-3 px-5 pt-4 text-left transition-colors hover:bg-surface-sunk',
                            item.reactions ? 'pb-2' : 'pb-4',
                          ].join(' ')}
                        >
                          <span className={['flex h-9 w-9 shrink-0 items-center justify-center rounded-md', meta.tone].join(' ')}>
                            <Icon aria-hidden size={17} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-start gap-3">
                              <span className={['min-w-0 flex-1 text-sm text-fg', item.unread ? 'font-semibold' : 'font-medium'].join(' ')}>{item.title}</span>
                              <span className="tnum shrink-0 text-2xs text-fg-subtle">{item.time}</span>
                            </span>
                            <span className="mt-1 block text-xs leading-relaxed text-fg-muted">{item.detail}</span>
                          </span>
                        </button>
                        {item.reactions && <div className="flex gap-1.5 px-16 pb-3">{item.reactions.map((reaction) => <button key={reaction.emoji} onClick={() => react(item.id, reaction.emoji)} aria-pressed={item.reacted?.includes(reaction.emoji) ?? false} className={['min-h-8 rounded-pill border px-2 text-2xs font-semibold', item.reacted?.includes(reaction.emoji) ? 'border-accent bg-accent-subtle text-accent' : 'border-border bg-surface text-fg-muted hover:border-border-strong'].join(' ')} aria-label={`React ${reaction.emoji} to ${item.title}`}>{reaction.emoji} <span className="tnum">{reaction.count}</span></button>)}</div>}
                        </article>
                      )
                    })}
                  </section>
                )
              })}
              {visibleItems.length === 0 && <div className="p-8 text-center"><Check aria-hidden size={22} className="mx-auto text-success" /><p className="mt-3 text-sm font-semibold text-fg">Nothing needs attention.</p><p className="mt-1 text-xs text-fg-muted">Updates stay available in their own tab.</p></div>}
            </div>

            <footer className="flex shrink-0 items-center gap-2 border-t border-border bg-surface-sunk px-5 py-3 text-2xs text-fg-muted">
              <Check aria-hidden size={13} className="text-success" />
              {filter === 'action' ? 'Customer work stays separate from recognition updates.' : 'Read state is local to this preview session.'}
            </footer>
          </aside>
        </div>
      )}
    </>
  )
}
