import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  CircleDot,
  Clock3,
  MessageSquareWarning,
  TrendingUp,
} from 'lucide-react'
import { useClient } from '../../shell/ClientProvider'
import { useQueue, useSnippets, useLiveRefresh } from '../../lib/inbox-data'
import { waitingLongest, unpickedEscalations } from '../../lib/landing-data'
import { EmptyState } from '../../ui/EmptyState'
import { Skeleton } from '../../ui/Skeleton'
import { Button } from '../../ui/Button'

function Metric({ label, value, detail, tone = 'neutral' }: { label: string; value: string; detail: string; tone?: 'neutral' | 'danger' | 'success' }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-3.5 shadow-elev-1">
      <p className="text-xs font-medium text-fg-muted">{label}</p>
      <div className="mt-2 flex items-end gap-2">
        <strong className={[
          'tnum text-2xl leading-none tracking-[-0.04em]',
          tone === 'danger' ? 'text-danger' : tone === 'success' ? 'text-success' : 'text-fg',
        ].join(' ')}>{value}</strong>
        <span className="pb-0.5 text-2xs text-fg-muted">{detail}</span>
      </div>
    </div>
  )
}

function ExceptionRow({
  icon: Icon,
  title,
  detail,
  meta,
  to,
  danger = false,
}: {
  icon: typeof Bot
  title: string
  detail: string
  meta: string
  to: string
  danger?: boolean
}) {
  return (
    <article className="group grid gap-3 border-b border-border px-4 py-3.5 last:border-0 sm:grid-cols-[auto_1fr_auto] sm:items-center">
      <span className={[
        'flex h-9 w-9 items-center justify-center rounded-md',
        danger ? 'bg-danger-subtle text-danger' : 'bg-warn-subtle text-warn',
      ].join(' ')}>
        <Icon aria-hidden size={17} />
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-fg">{title}</h3>
          <span className="tnum text-2xs font-semibold text-fg-subtle">{meta}</span>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-fg-muted">{detail}</p>
      </div>
      <Link to={to} className="inline-flex min-h-11 items-center justify-center gap-1 rounded-md px-3 text-xs font-semibold text-accent hover:bg-accent-subtle">Resolve <ArrowRight aria-hidden size={14} /></Link>
    </article>
  )
}

export function Floor() {
  const { activeClient } = useClient()
  const clientId = activeClient?.id ?? null
  const { items, loading, error, reload } = useQueue(clientId)
  const { snippets, reload: reloadSnippets } = useSnippets(clientId)
  useLiveRefresh(clientId, () => {
    void reload()
    void reloadSnippets()
  })

  const waiting = useMemo(() => waitingLongest(items), [items])
  const unpicked = useMemo(() => unpickedEscalations(items), [items])
  const overdue15m = waiting.filter((item) => {
    if (!item.last_customer_message_at) return false
    return Date.now() - new Date(item.last_customer_message_at).getTime() > 15 * 60_000
  })

  if (loading) {
    return (
      <div className="page-frame space-y-4">
        <Skeleton className="h-10 w-60" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-24" /><Skeleton className="h-24" />
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (error) {
    return <div className="p-6"><EmptyState title="Couldn't load the floor" body="Check your connection and try again." /></div>
  }

  const oldest = waiting[0]
  const firstHandover = unpicked[0]
  const combinedLiveException = !!oldest && oldest.id === firstHandover?.id
  const oldestName = oldest?.contact?.profile_name ?? oldest?.contact?.external_id ?? 'Customer'
  const oldestSnippet = oldest ? snippets.get(oldest.id)?.text ?? 'Waiting for a reply' : ''
  const openDecisionCount = (firstHandover ? 1 : 0) + (oldest && !combinedLiveException ? 1 : 0)

  return (
    <div className="page-frame space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-success">
            <CircleDot aria-hidden size={12} className="fill-success" /> Live floor
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-fg">Floor</h1>
          <p className="mt-1 text-sm text-fg-muted">Customer wait times and unassigned handovers.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/dashboard"><Button variant="secondary" size="sm"><TrendingUp aria-hidden size={15} /> View analytics</Button></Link>
        </div>
      </header>

      <section aria-labelledby="floor-health">
        <h2 id="floor-health" className="sr-only">Floor health</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Metric label="Customers waiting" value={String(waiting.length)} detail={`${overdue15m.length} over 15m`} tone={overdue15m.length ? 'danger' : 'neutral'} />
          <Metric label="Human handovers" value={String(unpicked.length)} detail="not picked up" tone={unpicked.length ? 'danger' : 'success'} />
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-elev-2" aria-labelledby="manager-decisions">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface-raised px-4 py-3.5">
          <div>
            <p className="label-caps text-danger">Needs your decision</p>
            <h2 id="manager-decisions" className="mt-1 text-md font-semibold tracking-[-0.02em] text-fg">Clear these blockers first</h2>
          </div>
          <span className="tnum rounded-pill bg-danger-subtle px-2.5 py-1 text-2xs font-semibold text-danger">{openDecisionCount} open</span>
        </div>

        {firstHandover && (
          <ExceptionRow
            icon={MessageSquareWarning}
            title={`${firstHandover.contact?.profile_name ?? 'Customer'} needs a human owner`}
            detail={combinedLiveException ? `This is also the longest-waiting customer: “${oldestSnippet}” Assign one owner and reply now.` : 'The bot handed this conversation over and stopped. Nobody has picked it up yet.'}
            meta={combinedLiveException ? 'Live · longest wait' : 'Live'}
            to={`/inbox?c=${encodeURIComponent(firstHandover.id)}`}
            danger
          />
        )}
        {oldest && !combinedLiveException && (
          <ExceptionRow
            icon={Clock3}
            title={`${oldestName} is waiting longest`}
            detail={`“${oldestSnippet}”`}
            meta="Live"
            to={`/inbox?c=${encodeURIComponent(oldest.id)}`}
            danger={overdue15m.includes(oldest)}
          />
        )}
        {!oldest && !unpicked.length && (
          <div className="flex items-center gap-3 px-4 py-6 text-sm text-success">
            <CheckCircle2 aria-hidden size={20} /> No customer needs a manager right now.
          </div>
        )}
      </section>

    </div>
  )
}
