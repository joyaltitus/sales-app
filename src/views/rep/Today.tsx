import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BellRing,
  CalendarCheck2,
  Check,
  ChevronRight,
  CircleAlert,
  Clock3,
  MessageCircle,
  Phone,
  Target,
  TimerReset,
  X,
} from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { useClient } from '../../shell/ClientProvider'
import { useQueue, useSnippets } from '../../lib/inbox-data'
import { completeFollowUp, snoozeFollowUp, useFollowUps } from '../../lib/leads-data'
import { waitingLongest, isOverdue } from '../../lib/landing-data'
import { useTodos, toggleTodo } from '../../lib/todos-data'
import { useRepDailyStats } from '../../lib/stats-data'
import { firstOfMonth, useTarget } from '../../lib/targets-data'
import { isSubscribed, pushSupported, subscribe } from '../../lib/push'
import { EmptyState } from '../../ui/EmptyState'
import { Skeleton } from '../../ui/Skeleton'
import { Avatar } from '../../ui/Avatar'

type LocalState = 'active' | 'done' | 'snoozed'

function ProgressRing({ value }: { value: number }) {
  const radius = 38
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (Math.min(100, Math.max(0, value)) / 100) * circumference

  return (
    <div className="relative h-24 w-24 shrink-0" role="progressbar" aria-label="Daily follow-up target" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
      <svg viewBox="0 0 96 96" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="48" cy="48" r={radius} fill="none" stroke="var(--surface-sunk)" strokeWidth="8" />
        <circle
          cx="48"
          cy="48"
          r={radius}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-[var(--motion-slow)]"
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <strong className="tnum text-lg leading-none text-fg">{value}%</strong>
        <span className="mt-1 text-2xs font-semibold text-fg-muted">today</span>
      </span>
    </div>
  )
}

const PUSH_BANNER_DISMISSED_KEY = 'sales-app.pushBannerDismissed'

/** S12 SA-PUSH-01: gesture-gated ask, never a nag. Hidden once subscribed, once permission
 *  is denied, or once dismissed (persisted — a rep who says no once should not see it again). */
function NotifyMeBanner() {
  const [supported] = useState(() => pushSupported())
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(PUSH_BANNER_DISMISSED_KEY) === '1'
    } catch {
      return false
    }
  })
  const [denied, setDenied] = useState(
    () => typeof Notification !== 'undefined' && Notification.permission === 'denied',
  )
  const [subscribed, setSubscribed] = useState(false)

  useEffect(() => {
    if (!supported) return
    let live = true
    isSubscribed().then((value) => {
      if (live) setSubscribed(value)
    })
    return () => {
      live = false
    }
  }, [supported])

  if (!supported || dismissed || denied || subscribed) return null

  const dismiss = () => {
    setDismissed(true)
    try {
      localStorage.setItem(PUSH_BANNER_DISMISSED_KEY, '1')
    } catch {
      /* non-persistent browser; the in-session dismiss still holds */
    }
  }

  const onNotifyMe = async () => {
    const result = await subscribe()
    if (result.kind === 'ok') setSubscribed(true)
    else if (result.kind === 'denied') setDenied(true)
    // any other outcome (unsupported/hub_error) leaves the banner as-is — a transient
    // failure should not read as a permanent no.
  }

  return (
    <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-dashed border-border bg-surface-sunk px-3 py-2 text-2xs text-fg-muted">
      <p className="flex items-center gap-1.5">
        <BellRing aria-hidden size={13} />
        Get told about labeled chats and follow-ups without keeping the app open.
      </p>
      <div className="flex shrink-0 items-center gap-3">
        <button onClick={onNotifyMe} className="font-semibold text-accent hover:underline">
          Notify me
        </button>
        <button onClick={dismiss} aria-label="Dismiss" className="text-fg-subtle hover:text-fg">
          <X aria-hidden size={13} />
        </button>
      </div>
    </div>
  )
}

function OverviewMetric({
  icon: Icon,
  label,
  value,
  detail,
  tone = 'neutral',
}: {
  icon: typeof Clock3
  label: string
  value: number
  detail: string
  tone?: 'neutral' | 'danger' | 'success' | 'accent'
}) {
  const toneClass = tone === 'danger'
    ? 'bg-danger-subtle text-danger'
    : tone === 'success'
      ? 'bg-success-subtle text-success'
      : tone === 'accent'
        ? 'bg-accent-subtle text-accent'
        : 'bg-surface-sunk text-fg-muted'

  return (
    <article className="min-w-0 rounded-lg border border-border bg-surface-raised p-3 shadow-elev-1">
      <div className={['flex h-7 w-7 items-center justify-center rounded-md sm:h-8 sm:w-8', toneClass].join(' ')}>
        <Icon aria-hidden size={15} />
      </div>
      <p className="tnum mt-2 text-xl font-semibold tracking-[-0.04em] text-fg sm:mt-3 sm:text-2xl">{value}</p>
      <p className="mt-0.5 text-xs font-semibold text-fg">{label}</p>
      <p className="mt-1 text-2xs leading-relaxed text-fg-muted">{detail}</p>
    </article>
  )
}

function PriorityCard({
  icon: Icon,
  eyebrow,
  title,
  detail,
  tone = 'neutral',
  action,
  onDone,
  onSnooze,
}: {
  icon: typeof Clock3
  eyebrow: string
  title: string
  detail: React.ReactNode
  tone?: 'neutral' | 'danger' | 'warn'
  action: React.ReactNode
  onDone?: () => void
  onSnooze?: () => void
}) {
  const [dragStart, setDragStart] = useState<number | null>(null)
  const [dragX, setDragX] = useState(0)
  const dragXRef = useRef(0)
  const toneClass = tone === 'danger' ? 'text-danger bg-danger-subtle' : tone === 'warn' ? 'text-warn bg-warn-subtle' : 'text-accent bg-accent-subtle'
  return (
    <div className="relative overflow-hidden rounded-lg bg-surface-sunk shadow-elev-1">
      {(onDone || onSnooze) && <div aria-hidden className="absolute inset-0 flex items-center justify-between px-4 text-2xs font-semibold"><span className="text-success"><Check size={14} className="mr-1 inline" /> Done</span><span className="text-fg-muted">Snooze <TimerReset size={14} className="ml-1 inline" /></span></div>}
    <article
      className="group relative overflow-hidden rounded-lg border border-border bg-surface transition-transform duration-[var(--motion-fast)]"
      style={{ transform: `translateX(${dragX}px)`, touchAction: 'pan-y', transition: dragStart == null ? undefined : 'none' }}
      onPointerDown={(event) => {
        if (event.pointerType !== 'touch') return
        setDragStart(event.clientX)
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={(event) => {
        if (dragStart == null || event.pointerType !== 'touch') return
        const next = Math.max(-96, Math.min(96, event.clientX - dragStart))
        dragXRef.current = next
        setDragX(next)
      }}
      onPointerUp={() => {
        if (dragXRef.current > 72 && onDone) onDone()
        if (dragXRef.current < -72 && onSnooze) onSnooze()
        setDragStart(null)
        setDragX(0)
        dragXRef.current = 0
      }}
      onPointerCancel={() => { setDragStart(null); setDragX(0); dragXRef.current = 0 }}
    >
      <div className="flex gap-3 p-3.5">
        <span className={['flex h-9 w-9 shrink-0 items-center justify-center rounded-md', toneClass].join(' ')}>
          <Icon aria-hidden size={17} strokeWidth={1.9} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="label-caps">{eyebrow}</p>
          <h3 className="mt-1 text-sm font-semibold tracking-[-0.01em] text-fg">{title}</h3>
          <div className="mt-1 text-xs leading-relaxed text-fg-muted">{detail}</div>
        </div>
        <div className="shrink-0 self-center">{action}</div>
      </div>
      {(onDone || onSnooze) && (
        <div className="flex border-t border-border bg-surface-sunk/60">
          {onSnooze && (
            <button onClick={onSnooze} className="flex min-h-10 flex-1 items-center justify-center gap-1.5 text-2xs font-semibold text-fg-muted hover:bg-surface-sunk hover:text-fg">
              <TimerReset aria-hidden size={13} /> Snooze
            </button>
          )}
          {onDone && (
            <button onClick={onDone} className="flex min-h-10 flex-1 items-center justify-center gap-1.5 border-l border-border text-2xs font-semibold text-fg-muted hover:bg-success-subtle hover:text-success">
              <Check aria-hidden size={13} /> Done
            </button>
          )}
        </div>
      )}
    </article>
    </div>
  )
}

export function Today() {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  const { activeClient } = useClient()
  const clientId = activeClient?.id ?? null
  const { items, loading, error } = useQueue(clientId)
  const { snippets } = useSnippets(clientId)
  const { items: liveFollowUps, loading: followUpsLoading, error: followUpsError, reload: reloadFollowUps } = useFollowUps(clientId)
  const { items: todos } = useTodos(clientId)
  const { stats } = useRepDailyStats(clientId, userId)
  const { item: target } = useTarget(clientId, userId, firstOfMonth())

  const followUps = liveFollowUps

  const waiting = useMemo(() => waitingLongest(items), [items])
  const oldest = waiting[0] ?? null
  const overdue = useMemo(
    () => followUps.filter((item) => isOverdue(item.due_at)).slice(0, 2),
    [followUps],
  )
  const myOpenTodos = useMemo(
    () => todos.filter((t) => t.assignee === userId && t.status === 'pending'),
    [todos, userId],
  )
  const pendingTodo = myOpenTodos[0] ?? null
  const [local, setLocal] = useState<Record<string, LocalState>>({})
  const [showAll, setShowAll] = useState(false)

  if (loading || followUpsLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 p-4 lg:p-6">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-64 w-full" />
        <div className="grid gap-4 lg:grid-cols-2"><Skeleton className="h-72 w-full" /><Skeleton className="h-72 w-full" /></div>
      </div>
    )
  }

  if (error || followUpsError) {
    return (
      <div className="p-6">
        <EmptyState title="Couldn't load your day" body="Check your connection and try again." />
      </div>
    )
  }

  const progressPct = stats.followUpsPlanned > 0 ? Math.round((stats.followUpsDone / stats.followUpsPlanned) * 100) : 0
  const oldestName = oldest?.contact?.profile_name ?? oldest?.contact?.external_id ?? 'Customer'
  const oldestSnippet = oldest ? snippets.get(oldest.id)?.text ?? 'A customer is waiting for your reply.' : null
  const visibleOverdue = showAll ? overdue : overdue.slice(0, 1)
  const openTodos = myOpenTodos.filter((todo) => !local[todo.id]).length
  const endOfToday = new Date()
  endOfToday.setHours(23, 59, 59, 999)
  const pendingCount = followUps.filter((item) => !local[item.id] && new Date(item.due_at).getTime() <= endOfToday.getTime()).length
  const workLeft = pendingCount + openTodos
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-5 pb-6 sm:pt-7 lg:px-6 lg:pb-10">
      <header className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.045em] text-fg">Today</h1>
          <p className="mt-1 text-sm text-fg-muted">Scheduled follow-ups, assigned tasks, and waiting replies.</p>
        </div>
      </header>

      <NotifyMeBanner />

      <section className="overflow-hidden rounded-xl border border-border bg-surface p-4 shadow-elev-2 sm:p-5">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center">
          <div className="flex min-w-0 items-center gap-4 xl:w-[340px] xl:shrink-0">
            <ProgressRing value={progressPct} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><p className="label-caps text-accent">Today overview</p><span className="text-2xs text-fg-subtle">{target ? `Target ₹${target.target_value.toLocaleString('en-IN')} this month` : 'No target set for you this month'}</span></div>
              <h2 className="mt-1.5 text-lg font-semibold tracking-[-0.025em] text-fg">{stats.followUpsDone} of {stats.followUpsPlanned} follow-ups done</h2>
              <p className="mt-1 text-xs leading-relaxed text-fg-muted">{workLeft} actions remain across assigned tasks and scheduled follow-ups.</p>
            </div>
          </div>
          <div className="grid flex-1 grid-cols-2 gap-2 lg:grid-cols-4">
            <OverviewMetric icon={Target} label="Need to do" value={workLeft} detail="Tasks + promises" tone="accent" />
            <OverviewMetric icon={CalendarCheck2} label="Done today" value={stats.followUpsDone} detail="Against daily target" tone="success" />
            <OverviewMetric icon={CircleAlert} label="Follow-ups" value={pendingCount} detail={`${overdue.length} overdue`} tone={overdue.length ? 'danger' : 'neutral'} />
            <OverviewMetric icon={MessageCircle} label="Waiting replies" value={waiting.length} detail="Inbox customers" />
          </div>
        </div>
        <p className="mt-4 text-2xs text-fg-muted">{stats.repliesToday} repl{stats.repliesToday === 1 ? 'y' : 'ies'} sent today{stats.responseTrend ? ` · ${stats.responseTrend}` : ''}</p>
      </section>

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="min-w-0">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="label-caps">Pending today</p>
            <h2 className="mt-1 text-lg font-semibold tracking-[-0.025em] text-fg">Follow-ups and assigned work</h2>
          </div>
          <Link to="/leads?tab=followups" className="text-xs font-semibold text-accent hover:underline">View all</Link>
        </div>

        <div className="space-y-3">
          {visibleOverdue.map((followUp) => !local[followUp.id] && (
            <PriorityCard
              key={followUp.id}
              icon={Phone}
              eyebrow="Overdue follow-up"
              title={followUp.note}
              detail="A promise is waiting. Open the lead, call, and capture the outcome."
              tone="danger"
              action={
                <Link to={`/leads?tab=followups&f=${encodeURIComponent(followUp.id)}`} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface text-fg-muted hover:border-border-strong hover:text-fg" aria-label="Open follow-up details">
                  <ChevronRight aria-hidden size={17} />
                </Link>
              }
              onDone={() => {
                setLocal((state) => ({ ...state, [followUp.id]: 'done' }))
                if (clientId) void completeFollowUp(clientId, followUp.id).then(reloadFollowUps)
              }}
              onSnooze={() => {
                setLocal((state) => ({ ...state, [followUp.id]: 'snoozed' }))
                if (clientId) void snoozeFollowUp(clientId, followUp.id).then(reloadFollowUps)
              }}
            />
          ))}

          {pendingTodo && !local[pendingTodo.id] && (
            <PriorityCard
              icon={Check}
              eyebrow="Manager todo"
              title={pendingTodo.title}
              detail={
                <span className="flex flex-wrap items-center gap-2">
                  <Avatar name={pendingTodo.createdByName ?? 'Manager'} size="sm" />
                  <span>
                    From {pendingTodo.createdByName ?? 'Manager'}
                    {pendingTodo.due_at
                      ? ` · due ${new Date(pendingTodo.due_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
                      : ''}
                  </span>
                </span>
              }
              action={
                <Link to={`/crm?tab=todos&t=${encodeURIComponent(pendingTodo.id)}`} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface text-fg-muted hover:border-border-strong hover:text-fg" aria-label="Open assigned todo details">
                  <ChevronRight aria-hidden size={17} />
                </Link>
              }
              onDone={() => {
                setLocal((state) => ({ ...state, [pendingTodo.id]: 'done' }))
                // The paint is optimistic; the write can still be refused. Fired
                // and forgotten, a denial left the rep looking at a todo marked
                // done that the manager still sees as open. Put the card back.
                if (clientId) {
                  void toggleTodo(clientId, pendingTodo.id, 'done', 'pending').then((res) => {
                    if (res.ok) return
                    setLocal((state) => {
                      const { [pendingTodo.id]: _undone, ...rest } = state
                      return rest
                    })
                  })
                }
              }}
              onSnooze={() => setLocal((state) => ({ ...state, [pendingTodo.id]: 'snoozed' }))}
            />
          )}
        </div>

        {(overdue.length > 1 || waiting.length > 1) && (
          <button onClick={() => setShowAll((value) => !value)} className="mt-3 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-md text-xs font-semibold text-fg-muted hover:bg-surface-sunk hover:text-fg">
            {showAll ? 'Show less' : `${overdue.length + Math.max(0, waiting.length - 1)} more items`} <ChevronRight aria-hidden size={14} className={showAll ? '-rotate-90' : 'rotate-90'} />
          </button>
        )}
        </section>

        <aside className="min-w-0 space-y-4 lg:sticky lg:top-5">
          {oldest ? (
            <section className="relative overflow-hidden rounded-xl border border-[color-mix(in_srgb,var(--accent)_28%,var(--border))] bg-[linear-gradient(145deg,var(--surface-raised),var(--accent-subtle))] p-5 shadow-elev-2">
              <span aria-hidden className="absolute -top-16 -right-16 h-40 w-40 rounded-full bg-signal opacity-20 blur-3xl" />
              <div className="relative">
                <div className="flex items-center justify-between gap-3"><p className="label-caps text-accent">Customer waiting</p><span className="tnum inline-flex items-center gap-1 text-2xs font-semibold text-danger"><Clock3 aria-hidden size={12} /> Longest</span></div>
                <h2 className="mt-3 text-xl font-semibold tracking-[-0.035em] text-fg">Reply to {oldestName}</h2>
                <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-fg-muted">“{oldestSnippet}”</p>
                <div className="mt-5"><Link to={`/inbox?c=${encodeURIComponent(oldest.id)}`} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md border border-accent bg-accent px-4 text-sm font-semibold text-accent-fg hover:bg-accent-hover"><MessageCircle aria-hidden size={17} /> Open chat <ArrowRight aria-hidden size={15} /></Link></div>
              </div>
            </section>
          ) : (
            <section className="rounded-xl border border-border bg-surface p-5 shadow-elev-1"><EmptyState icon={MessageCircle} title="Inbox clear" body="No customer replies are waiting." /></section>
          )}
        </aside>
      </div>

      {Object.values(local).some((state) => state === 'done') && (
        <p className="mt-5 rounded-lg bg-success-subtle p-3 text-xs font-semibold text-success" role="status"><Check aria-hidden size={14} className="mr-1.5 inline" /> Work item completed.</p>
      )}
    </div>
  )
}
