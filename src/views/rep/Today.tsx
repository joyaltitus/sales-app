import { lazy, Suspense, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Check,
  ChevronRight,
  Clock3,
  Flame,
  MessageCircle,
  Phone,
  Sunrise,
  TimerReset,
  Trophy,
} from 'lucide-react'
import { useClient } from '../../shell/ClientProvider'
import { useQueue, usePreviews } from '../../lib/inbox-data'
import { useFollowUps } from '../../lib/leads-data'
import { waitingLongest, isOverdue } from '../../lib/landing-data'
import { MOCK_PROGRESS } from '../../lib/mock-wave3'
import { EmptyState } from '../../ui/EmptyState'
import { Skeleton } from '../../ui/Skeleton'
import { Chip } from '../../ui/Chip'
import { Avatar } from '../../ui/Avatar'
import { TODO_PREVIEW_ITEMS } from '../crm/todoMocks'
import { CallButton } from '../calls/CallButton'
import { DealProbability } from '../revenue/DealProbability'

const TodayIntelligence = lazy(() => import('./TodayIntelligence'))

type LocalState = 'active' | 'done' | 'snoozed'

type CallbackPreview = {
  id: string
  person: string
  phone: string
  dueLabel: string
  reason: string
  dealValue: number
  sample: true
}

const CALLBACK_PREVIEW: CallbackPreview = {
  id: 'phase3-callback-anjali',
  person: 'Anjali Ramesh',
  phone: '+91 98765 42018',
  dueLabel: 'Today · 4:00 pm',
  reason: 'Confirm the two-instalment plan and ask for the decision.',
  dealValue: 60000,
  sample: true,
}

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
  const { activeClient } = useClient()
  const clientId = activeClient?.id ?? null
  const { items, loading, error } = useQueue(clientId)
  const { previews } = usePreviews(clientId)
  const { items: followUps } = useFollowUps(clientId)

  const waiting = useMemo(() => waitingLongest(items), [items])
  const oldest = waiting[0] ?? null
  const overdue = useMemo(
    () => followUps.filter((item) => isOverdue(item.due_at)).slice(0, 2),
    [followUps],
  )
  const pendingTodo = TODO_PREVIEW_ITEMS.find((todo) => todo.status === 'open' && todo.assignees.includes('Asha Thomas')) ?? null
  const [local, setLocal] = useState<Record<string, LocalState>>({})
  const [showAll, setShowAll] = useState(false)

  if (loading) {
    return (
      <div className="mx-auto max-w-xl space-y-4 p-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <EmptyState title="Couldn't load your day" body="Check your connection and try again." />
      </div>
    )
  }

  const progressPct = Math.round((MOCK_PROGRESS.followUpsDone / MOCK_PROGRESS.followUpsPlanned) * 100)
  const oldestName = oldest?.contact?.profile_name ?? oldest?.contact?.external_id ?? 'Customer'
  const oldestPreview = oldest ? previews.get(oldest.id) ?? 'A customer is waiting for your reply.' : null
  const visibleOverdue = showAll ? overdue : overdue.slice(0, 1)

  return (
    <div className="mx-auto w-full max-w-xl px-4 pt-5 pb-4 sm:pt-7">
      <header className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold text-accent">
            <Sunrise aria-hidden size={14} /> Your day is ready
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-[-0.045em] text-fg">Good morning.</h1>
          <p className="mt-1 text-sm text-fg-muted">Start with the customer who needs you most.</p>
        </div>
        <Chip tone="accent"><Flame aria-hidden size={12} /> {MOCK_PROGRESS.streakDays} days</Chip>
      </header>

      {oldest ? (
        <section className="relative overflow-hidden rounded-xl border border-[color-mix(in_srgb,var(--accent)_28%,var(--border))] bg-[linear-gradient(145deg,var(--surface-raised),var(--accent-subtle))] p-5 shadow-elev-2">
          <span aria-hidden className="absolute -top-16 -right-16 h-40 w-40 rounded-full bg-signal opacity-20 blur-3xl" />
          <div className="relative">
            <div className="flex items-center justify-between gap-3">
              <p className="label-caps text-accent">Do this now</p>
              <span className="tnum inline-flex items-center gap-1 text-2xs font-semibold text-danger">
                <Clock3 aria-hidden size={12} /> Waiting longest
              </span>
            </div>
            <h2 className="mt-3 text-xl font-semibold tracking-[-0.035em] text-fg">Reply to {oldestName}</h2>
            <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-fg-muted">“{oldestPreview}”</p>
            <div className="mt-3 flex items-center gap-2"><strong className="tnum text-lg text-fg">₹60,000</strong><span className="text-2xs text-fg-muted">open deal</span><DealProbability probability={68} person={oldestName} /></div>
            <div className="mt-5 grid grid-cols-[minmax(0,1fr)_auto] gap-3">
              <Link
                to={`/inbox?c=${encodeURIComponent(oldest.id)}`}
                className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-md border border-accent bg-accent px-5 text-sm font-semibold text-accent-fg shadow-[0_10px_28px_-16px_var(--accent)] transition-[background-color,transform] hover:-translate-y-px hover:bg-accent-hover active:translate-y-0"
              >
                <MessageCircle aria-hidden size={17} /> Reply now <ArrowRight aria-hidden size={15} />
              </Link>
              <CallButton person={oldestName} phone={oldest?.contact?.external_id} dealValue={60000} label="Call" />
            </div>
          </div>
        </section>
      ) : (
        <section className="rounded-xl border border-border bg-surface p-5 shadow-elev-1">
          <EmptyState icon={Trophy} title="Inbox clear. Nicely done." body="Use the breathing room to rescue a lead that has gone quiet." />
        </section>
      )}

      <Suspense fallback={<Skeleton className="mt-4 h-40 w-full" />}><TodayIntelligence /></Suspense>

      <section className="mt-4 flex items-center gap-5 rounded-xl border border-border bg-surface p-4 shadow-elev-1">
        <ProgressRing value={progressPct} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="label-caps">Daily momentum</p>
            <span className="text-2xs text-fg-subtle">Preview</span>
          </div>
          <h2 className="mt-1.5 text-md font-semibold tracking-[-0.02em] text-fg">
            {MOCK_PROGRESS.followUpsDone} of {MOCK_PROGRESS.followUpsPlanned} follow-ups done
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-fg-muted">Two more keeps your {MOCK_PROGRESS.streakDays}-day streak alive.</p>
          <div className="mt-3 flex gap-4 text-2xs font-medium text-fg-muted">
            <span><strong className="tnum text-fg">{MOCK_PROGRESS.repliesToday}</strong> replies</span>
            <span><strong className="tnum text-success">9m</strong> median</span>
          </div>
        </div>
      </section>

      <section className="mt-6">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="label-caps">Then keep moving</p>
            <h2 className="mt-1 text-lg font-semibold tracking-[-0.025em] text-fg">Your priority stack</h2>
          </div>
          <span className="text-2xs text-fg-muted">Swipe affordances are preview-only</span>
        </div>

        <div className="space-y-3">
          {!local[CALLBACK_PREVIEW.id] && (
            <PriorityCard
              icon={Phone}
              eyebrow={`Callback · ${CALLBACK_PREVIEW.dueLabel} · Preview`}
              title={`Call ${CALLBACK_PREVIEW.person}`}
              detail={CALLBACK_PREVIEW.reason}
              tone="warn"
              action={<CallButton person={CALLBACK_PREVIEW.person} phone={CALLBACK_PREVIEW.phone} dealValue={CALLBACK_PREVIEW.dealValue} variant="icon" />}
              onDone={() => setLocal((state) => ({ ...state, [CALLBACK_PREVIEW.id]: 'done' }))}
              onSnooze={() => setLocal((state) => ({ ...state, [CALLBACK_PREVIEW.id]: 'snoozed' }))}
            />
          )}

          {visibleOverdue.map((followUp) => !local[followUp.id] && (
            <PriorityCard
              key={followUp.id}
              icon={Phone}
              eyebrow="Overdue follow-up"
              title={followUp.note}
              detail="A promise is waiting. Open the lead, call, and capture the outcome."
              tone="danger"
              action={
                <Link to="/leads?tab=followups" className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface text-fg-muted hover:border-border-strong hover:text-fg" aria-label="Open follow-up">
                  <ChevronRight aria-hidden size={17} />
                </Link>
              }
              onDone={() => setLocal((state) => ({ ...state, [followUp.id]: 'done' }))}
              onSnooze={() => setLocal((state) => ({ ...state, [followUp.id]: 'snoozed' }))}
            />
          ))}

          {pendingTodo && !local[pendingTodo.id] && (
            <PriorityCard
              icon={Check}
              eyebrow={`${pendingTodo.priority} manager todo · Preview`}
              title={pendingTodo.title}
              detail={<span className="flex flex-wrap items-center gap-2"><Avatar name={pendingTodo.createdBy} size="sm" /><span>From {pendingTodo.createdBy} · {pendingTodo.dueLabel}</span>{pendingTodo.link && <span className="font-semibold text-accent">· {pendingTodo.link.label}</span>}</span>}
              action={
                <Link to={pendingTodo.link ? '/crm?tab=pipeline' : '/crm?tab=todos'} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface text-fg-muted hover:border-border-strong hover:text-fg" aria-label="Open assigned todo">
                  <ChevronRight aria-hidden size={17} />
                </Link>
              }
              onDone={() => setLocal((state) => ({ ...state, [pendingTodo.id]: 'done' }))}
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

      {Object.values(local).some((state) => state === 'done') && (
        <div className="relative mt-5 flex items-center gap-3 overflow-hidden rounded-xl border border-[color-mix(in_srgb,var(--success)_25%,var(--border))] bg-success-subtle p-4 text-success" role="status">
          <span aria-hidden className="absolute -right-3 -top-8 text-7xl font-bold text-success opacity-10">₹</span>
          <span className="flex h-8 w-8 items-center justify-center rounded-pill bg-surface"><Trophy aria-hidden size={16} /></span>
          <p className="relative text-xs font-semibold"><span className="block text-md tracking-[-0.02em]">₹60,000 moved forward.</span><span className="mt-1 block font-normal text-success">Nice. The next close is one action closer.</span></p>
        </div>
      )}
    </div>
  )
}
