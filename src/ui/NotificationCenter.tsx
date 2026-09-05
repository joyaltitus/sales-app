import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Bot, Check, Clock3, MessageCircleMore, UserPlus, X } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { useClient } from '../shell/ClientProvider'
import { markNotificationsRead, type NotificationRow, shortAge, useNotifications } from '../lib/notifications-data'
import { useRolePath } from '../shell/RoleRouter'

type NotificationKind = 'lead' | 'follow_up' | 'approval'
type NotificationFilter = 'unread' | 'all'

type NotificationItem = {
  id: string
  kind: NotificationKind
  title: string
  detail: string
  time: string
  day: 'Today' | 'Earlier'
  unread: boolean
  conversationId: string | null
  draft: string | null
}

const META = {
  lead: { icon: UserPlus, tone: 'text-info bg-info-subtle' },
  follow_up: { icon: Clock3, tone: 'text-warn bg-warn-subtle' },
  approval: { icon: Bot, tone: 'text-accent bg-accent-subtle' },
} as const

function toItem(row: NotificationRow, now: number): NotificationItem {
  const kind: NotificationKind =
    row.kind === 'labeled_to_you' ? 'lead' : row.kind === 'needs_human' ? 'approval' : 'follow_up'
  return {
    id: row.id,
    kind,
    title: row.title,
    detail: row.body ?? '',
    time: shortAge(row.created_at, now),
    day: now - new Date(row.created_at).getTime() < 24 * 60 * 60 * 1000 ? 'Today' : 'Earlier',
    unread: row.read_at === null,
    conversationId: row.conversation_id,
    draft: row.draft,
  }
}

export function NotificationCenter() {
  const rolePath = useRolePath()
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState<NotificationFilter>('unread')
  const [readLocally, setReadLocally] = useState<Set<string>>(() => new Set())
  const navigate = useNavigate()
  const { session } = useAuth()
  const { activeClient } = useClient()
  const { items: rows, reload } = useNotifications(activeClient?.id ?? null, session?.user.id ?? null)

  const items = useMemo<NotificationItem[]>(() => {
    const now = Date.now()
    return rows.map((row) => {
      const item = toItem(row, now)
      return readLocally.has(item.id) ? { ...item, unread: false } : item
    })
  }, [rows, readLocally])
  const unread = useMemo(() => items.filter((item) => item.unread).length, [items])
  const visibleItems = useMemo(
    () => filter === 'unread' ? items.filter((item) => item.unread) : items,
    [filter, items],
  )

  useEffect(() => {
    document.title = unread > 0 ? `(${unread}) Sales App` : 'Sales App'
    const badgeNav = navigator as Navigator & {
      setAppBadge?: (count?: number) => Promise<void>
      clearAppBadge?: () => Promise<void>
    }
    if (unread > 0) badgeNav.setAppBadge?.(unread).catch(() => {})
    else badgeNav.clearAppBadge?.().catch(() => {})
  }, [unread])

  useEffect(() => {
    if (!open) return
    const close = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [open])

  const markVisibleRead = () => {
    const ids = visibleItems.filter((item) => item.unread).map((item) => item.id)
    if (ids.length === 0) return
    setReadLocally((current) => new Set([...current, ...ids]))
    void markNotificationsRead(ids).then(reload)
  }

  const openItem = (item: NotificationItem) => {
    if (item.unread) {
      setReadLocally((current) => new Set(current).add(item.id))
      void markNotificationsRead([item.id]).then(reload)
    }
    if (!item.conversationId) return
    setOpen(false)
    navigate(rolePath(`/inbox?c=${encodeURIComponent(item.conversationId)}`), {
      state: item.draft ? { draft: item.draft } : undefined,
    })
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative inline-flex h-11 w-11 items-center justify-center rounded-md border border-transparent text-fg-muted transition-colors hover:border-border hover:bg-surface-sunk hover:text-fg"
        aria-label={`${unread} unread notifications`}
      >
        <Bell aria-hidden size={17} strokeWidth={1.8} />
        {unread > 0 && <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-pill border-2 border-surface bg-danger" />}
      </button>

      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Notifications">
          <button className="sheet-overlay absolute inset-0 cursor-default bg-[var(--overlay)]" onClick={() => setOpen(false)} aria-label="Close notifications" />
          <aside className="sheet-panel absolute inset-y-0 right-0 flex w-full max-w-[420px] flex-col border-l border-border bg-surface shadow-elev-3">
            <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent-subtle text-accent"><MessageCircleMore aria-hidden size={18} /></div>
              <div className="min-w-0 flex-1">
                <h2 className="text-md font-semibold tracking-[-0.02em] text-fg">Notifications</h2>
                <p className="text-2xs text-fg-muted">{items.length === 1 ? '1 notification' : `${items.length} notifications`}</p>
              </div>
              <button onClick={() => setOpen(false)} className="inline-flex h-11 w-11 items-center justify-center rounded-md text-fg-muted hover:bg-surface-sunk hover:text-fg" aria-label="Close"><X aria-hidden size={18} /></button>
            </header>

            <div className="grid grid-cols-2 gap-1 border-b border-border bg-surface px-4 py-2" role="tablist" aria-label="Notification status">
              {([
                { key: 'unread', label: 'Unread' },
                { key: 'all', label: 'All' },
              ] as { key: NotificationFilter; label: string }[]).map((item) => (
                <button key={item.key} role="tab" aria-selected={filter === item.key} onClick={() => setFilter(item.key)} className={['min-h-10 rounded-md px-2 text-2xs font-semibold', filter === item.key ? 'bg-accent-subtle text-accent' : 'text-fg-muted hover:bg-surface-sunk hover:text-fg'].join(' ')}>{item.label}</button>
              ))}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {(['Today', 'Earlier'] as const).map((day) => {
                const group = visibleItems.filter((item) => item.day === day)
                if (!group.length) return null
                return (
                  <section key={day} aria-labelledby={`notification-${day}`}>
                    <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface-glass px-5 py-2.5 backdrop-blur-xl">
                      <h3 id={`notification-${day}`} className="label-caps">{day}</h3>
                      {group.some((item) => item.unread) && <button onClick={markVisibleRead} className="min-h-9 text-2xs font-semibold text-accent hover:text-accent-hover">Mark read</button>}
                    </div>
                    {group.map((item) => {
                      const meta = META[item.kind]
                      const Icon = meta.icon
                      return (
                        <article key={item.id} className={['relative border-b border-border', item.unread ? 'bg-accent-subtle/35' : 'bg-surface'].join(' ')}>
                          {item.unread && <span className="absolute top-7 left-1.5 h-1.5 w-1.5 rounded-pill bg-accent" />}
                          <button onClick={() => openItem(item)} className="flex w-full gap-3 px-5 py-4 text-left transition-colors hover:bg-surface-sunk">
                            <span className={['flex h-9 w-9 shrink-0 items-center justify-center rounded-md', meta.tone].join(' ')}><Icon aria-hidden size={17} /></span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-start gap-3">
                                <span className={['min-w-0 flex-1 text-sm text-fg', item.unread ? 'font-semibold' : 'font-medium'].join(' ')}>{item.title}</span>
                                <span className="tnum shrink-0 text-2xs text-fg-subtle">{item.time}</span>
                              </span>
                              {item.detail && <span className="mt-1 block text-xs leading-relaxed text-fg-muted">{item.detail}</span>}
                            </span>
                          </button>
                        </article>
                      )
                    })}
                  </section>
                )
              })}
              {visibleItems.length === 0 && <div className="p-8 text-center"><Check aria-hidden size={22} className="mx-auto text-success" /><p className="mt-3 text-sm font-semibold text-fg">No notifications</p><p className="mt-1 text-xs text-fg-muted">New notifications will appear here.</p></div>}
            </div>

            {visibleItems.some((item) => item.unread) && (
              <footer className="flex shrink-0 justify-end border-t border-border bg-surface-sunk px-5 py-3"><button onClick={markVisibleRead} className="min-h-9 text-2xs font-semibold text-accent hover:text-accent-hover">Mark visible read</button></footer>
            )}
          </aside>
        </div>
      )}
    </>
  )
}
