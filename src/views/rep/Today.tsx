import { useMemo } from 'react'
import { useClient } from '../../shell/ClientProvider'
import { useQueue, usePreviews } from '../../lib/inbox-data'
import { useFollowUps } from '../../lib/leads-data'
import { waitingLongest, dueToday, isOverdue } from '../../lib/landing-data'
import { EmptyState } from '../../ui/EmptyState'
import { Skeleton } from '../../ui/Skeleton'
import { SectionHeader, SectionEmpty, ThreadList } from '../landing/LandingSection'
import { ThreadHero } from '../landing/ThreadHero'

// TODAY — the rep's landing (§1.11). The one question it answers is
// "what do I do next?", so it opens with a single thread, not a dashboard.
//
// Adds NO conversation query: it derives from useQueue, the same bounded,
// tenant-scoped read the Inbox already issues, and from useFollowUps, the same
// read the Leads board already issues.
export function Today() {
  const { activeClient } = useClient()
  const clientId = activeClient?.id ?? null

  const { items, loading, error } = useQueue(clientId)
  const { previews } = usePreviews(clientId)
  const { items: followUps } = useFollowUps(clientId)

  const waiting = useMemo(() => waitingLongest(items), [items])
  const [oldest, ...rest] = waiting
  const today = useMemo(() => dueToday(followUps), [followUps])

  if (loading) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
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

  return (
    <div className="pb-6">
      {oldest ? (
        <>
          <SectionHeader title="Waiting longest" />
          <ThreadHero
            item={oldest}
            preview={previews.get(oldest.id) ?? oldest.contact?.profile_name ?? '—'}
          />
        </>
      ) : (
        <div className="p-6">
          {/* Nobody waiting is the GOOD outcome, so it reads as one. */}
          <EmptyState
            title="Everyone's been answered."
            body="New WhatsApp and Instagram messages land here as they arrive."
          />
        </div>
      )}

      {rest.length > 0 && (
        <>
          <SectionHeader title="Then" count={rest.length} />
          <ThreadList items={rest} previews={previews} />
        </>
      )}

      <SectionHeader title="Follow-ups today" count={today.length} />
      {today.length === 0 ? (
        <SectionEmpty>Nothing due today.</SectionEmpty>
      ) : (
        <ul>
          {today.map((f) => (
            <li
              key={f.id}
              className="flex items-baseline gap-3 border-b border-border bg-surface px-4 py-3"
            >
              <span
                className={[
                  'tnum shrink-0 text-2xs uppercase',
                  isOverdue(f.due_at) ? 'text-danger' : 'text-fg-subtle',
                ].join(' ')}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 'var(--weight-caps)',
                  letterSpacing: 'var(--tracking-caps)',
                }}
              >
                {isOverdue(f.due_at) ? 'Overdue' : 'Due'}
              </span>
              <span className="min-w-0 flex-1 text-sm text-fg">{f.note}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
