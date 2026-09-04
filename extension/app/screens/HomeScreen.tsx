import { useEffect, useState } from 'react'
import { CircleAlert, CloudUpload } from 'lucide-react'
import type { QueueItem } from '../../lib/contracts'
import { readOutbox } from '../../lib/outbox-store'
import { Button } from '../../../src/ui/Button'
import { Chip } from '../../../src/ui/Chip'
import { EmptyState } from '../../../src/ui/EmptyState'
import { ErrorState } from '../../../src/ui/ErrorState'
import { ListRow } from '../../../src/ui/ListRow'
import { StaleChip } from '../../ui/StaleChip'
import { QueueSkeleton } from '../../ui/Skeletons'
import { formatClock } from '../../ui/time'

type Props = {
  items: QueueItem[]
  loading: boolean
  error: string | null
  staleAt: string | null
  target: React.ReactNode
  onRetry: () => void
  onOpenLead: (item: QueueItem) => void
  onSeeQueue: () => void
}

/**
 * Home — the first thing a rep sees, and the only screen whose reads run on open.
 *
 * Every number here comes from the ONE queue read the panel already caches.
 * rep_queue_v carries `due_at` and a `reason` of overdue | due | new | idle and
 * arrives ordered by due_at, so "the next action" and "due today" are slices of
 * a list already in memory rather than two more round trips on the critical path.
 */

/** Oldest overdue follow-up; failing that, the oldest row nobody has touched. */
export function nextAction(items: QueueItem[]): QueueItem | null {
  return (
    items.find((item) => item.reason === 'overdue') ??
    items.find((item) => item.reason === 'due') ??
    items.find((item) => item.reason === 'new') ??
    items[0] ??
    null
  )
}

export function dueToday(items: QueueItem[]): QueueItem[] {
  return items.filter((item) => item.reason === 'overdue' || item.reason === 'due')
}

function OutboxState() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let alive = true
    const read = () => void readOutbox().then((entries) => { if (alive) setCount(entries.length) })
    read()
    // The outbox drains from AuthGate on reconnect, so the count has to react to
    // a change this component did not make.
    const onChanged = () => read()
    chrome.storage.onChanged.addListener(onChanged)
    return () => {
      alive = false
      chrome.storage.onChanged.removeListener(onChanged)
    }
  }, [])

  if (count === 0) return null
  return (
    <div className="flex min-h-9 items-center gap-2 rounded-md border border-border bg-surface-sunk px-3 py-2 text-xs text-fg-muted">
      <CloudUpload aria-hidden size={14} strokeWidth={1.9} className="shrink-0 text-fg-subtle" />
      <span className="min-w-0 flex-1">
        {count} change{count === 1 ? '' : 's'} waiting to save
      </span>
      <Chip tone="warn">Offline</Chip>
    </div>
  )
}

export default function HomeScreen({
  items, loading, error, staleAt, target, onRetry, onOpenLead, onSeeQueue,
}: Props) {
  if (loading) return <QueueSkeleton />
  if (error && items.length === 0) {
    return <ErrorState title="Couldn’t load your day" body="Check your connection, then retry." onRetry={onRetry} />
  }

  const next = nextAction(items)
  const due = dueToday(items)

  return (
    <div className="space-y-4 p-3">
      {staleAt && <StaleChip fetched_at={staleAt} />}
      {error && items.length > 0 && (
        <div role="alert" className="flex min-h-10 items-center gap-2 rounded-md bg-warn-subtle px-3 py-2 text-xs text-warn">
          <CircleAlert aria-hidden size={14} strokeWidth={1.9} className="shrink-0" />
          <span className="min-w-0 flex-1">Showing your last saved day.</span>
          <Button variant="ghost" size="sm" onClick={onRetry}>Retry</Button>
        </div>
      )}

      {/* One primary action per screen: this is it. */}
      <section aria-label="Next action">
        <h2 className="label-caps">Do this next</h2>
        {next ? (
          <div className="mt-1.5 rounded-lg border border-border bg-surface-raised p-3 shadow-elev-1">
            <p className="truncate text-md font-semibold tracking-[-0.015em] text-fg">{next.display_name}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-2xs text-fg-subtle">
              <span className="truncate">{next.stage_label}</span>
              <Chip tone={next.reason === 'overdue' ? 'danger' : next.reason === 'due' ? 'accent' : 'neutral'}>
                {next.reason}
              </Chip>
            </p>
            <Button className="mt-3 h-12 w-full" onClick={() => onOpenLead(next)}>
              Open {next.display_name}
            </Button>
          </div>
        ) : (
          <div className="mt-1.5 rounded-lg border border-border bg-surface-raised shadow-elev-1">
            <EmptyState title="Nothing waiting" body="No follow-ups due and no new leads. Enjoy it." />
          </div>
        )}
      </section>

      <section aria-label="Follow-ups due today">
        <div className="flex items-center gap-2">
          <h2 className="label-caps">Due today</h2>
          <span className="text-2xs text-fg-subtle tnum">{due.length}</span>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={onSeeQueue}>
            All leads
          </Button>
        </div>
        {due.length === 0 ? (
          <p className="mt-1 rounded-md border border-border bg-surface px-3 py-2.5 text-xs text-fg-subtle">
            No follow-ups due today.
          </p>
        ) : (
          <ul className="mt-1 overflow-hidden rounded-lg border border-border">
            {due.slice(0, 5).map((item) => (
              <li key={item.lead_id}>
                <ListRow
                  name={item.display_name}
                  snippet={item.stage_label}
                  timestamp={item.due_at ? formatClock(item.due_at) : undefined}
                  onClick={() => onOpenLead(item)}
                  trailing={<Chip tone={item.reason === 'overdue' ? 'danger' : 'accent'}>{item.reason}</Chip>}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Your month">
        <h2 className="label-caps">Your month</h2>
        <div className="mt-1 overflow-hidden rounded-lg border border-border">{target}</div>
      </section>

      <OutboxState />
    </div>
  )
}
