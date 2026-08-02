import { useMemo } from 'react'
import { useClient } from '../../shell/ClientProvider'
import { useQueue, usePreviews } from '../../lib/inbox-data'
import {
  pausedThreads,
  useLatestTraceRoutes,
  useOptedOutContacts,
  byLongestWait,
} from '../../lib/landing-data'
import { EmptyState } from '../../ui/EmptyState'
import { Skeleton } from '../../ui/Skeleton'
import { SectionHeader, SectionEmpty, ThreadList } from '../landing/LandingSection'
import { Activity, CircleAlert, PauseCircle, ShieldCheck } from 'lucide-react'

// HEALTH — the admin's landing (§1.11). The one question: is the machine
// behaving? Three answers, in the order an admin actually cares about them:
// where the bot has stopped, where it broke, and who has opted out.
//
// ⚠ SCOPE (§S5, verbatim): "scoped strictly to tables the browser can already
// read under RLS." Every source here is one of conversations, turn_traces or
// contacts, all of which are already tenant-readable
// (`client_id IN my_client_ids()`). `dead_letter` and `llm_usage_logs` are ops
// tables, are almost certainly not browser-readable, and are NOT reached for.
// If Health ever wants one, that is a separate src/api/ session with its own
// auth review — not a widened grant, not an elevated key, not faked. The wall
// test in src/shell/AdminShell.wall.test.tsx asserts this by name.
export function Health() {
  const { activeClient } = useClient()
  const clientId = activeClient?.id ?? null

  const { items, loading, error } = useQueue(clientId)
  const { previews } = usePreviews(clientId)
  const { routes, loading: routesLoading } = useLatestTraceRoutes(clientId)
  const { items: optedOut, loading: contactsLoading } = useOptedOutContacts(clientId)

  const paused = useMemo(() => pausedThreads(items), [items])

  // A thread counts as failing when its MOST RECENT trace is `error` — not when
  // it has ever errored. A conversation that erred and then recovered is not a
  // health problem, and listing it would make the screen cry wolf.
  const failing = useMemo(
    () => items.filter((c) => routes.get(c.id)?.route === 'error').sort(byLongestWait),
    [items, routes],
  )

  if (loading || routesLoading || contactsLoading) {
    return (
      <div className="space-y-2 p-6">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <EmptyState title="Couldn't load health" body="Check your connection and try again." />
      </div>
    )
  }

  return (
    <div className="page-frame space-y-5">
      <header>
        <div className="flex items-center gap-2 text-xs font-semibold text-success"><Activity aria-hidden size={14} /> Tenant status</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-fg">Only show me what’s broken.</h1>
        <p className="mt-1 text-sm text-fg-muted">Pauses, failed turns and consent exceptions across this workspace.</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        {([
          ['Bot paused', paused.length, PauseCircle, paused.length ? 'text-warn' : 'text-success'],
          ['Last turn failed', failing.length, CircleAlert, failing.length ? 'text-danger' : 'text-success'],
          ['Opted out', optedOut.length, ShieldCheck, 'text-fg'],
        ] as const).map(([label, value, Icon, tone]) => (
          <div key={String(label)} className="rounded-lg border border-border bg-surface p-4 shadow-elev-1">
            <Icon aria-hidden size={17} className={String(tone)} />
            <p className="label-caps mt-3">{String(label)}</p>
            <strong className={['tnum mt-1 block text-2xl tracking-[-0.04em]', String(tone)].join(' ')}>{String(value)}</strong>
          </div>
        ))}
      </div>

      <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-elev-1">
      <SectionHeader title="Bot paused" count={paused.length} hint="Machine has stopped replying" />
      {paused.length === 0 ? (
        <SectionEmpty>The bot is running on every conversation.</SectionEmpty>
      ) : (
        <ThreadList items={paused} previews={previews} cap={10} />
      )}
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-elev-1">
      <SectionHeader title="Last turn failed" count={failing.length} hint="Most recent trace is an error" />
      {failing.length === 0 ? (
        <SectionEmpty>No conversation ended its last turn in an error.</SectionEmpty>
      ) : (
        <ThreadList items={failing} previews={previews} cap={10} />
      )}
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-elev-1">
      <SectionHeader title="Opted out" count={optedOut.length} hint="Will not be messaged again" />
      {optedOut.length === 0 ? (
        <SectionEmpty>Nobody has opted out.</SectionEmpty>
      ) : (
        <ul>
          {optedOut.slice(0, 10).map((c) => (
            <li
              key={c.id}
              className="flex items-center gap-2 border-b border-border bg-surface px-4 py-3"
            >
              <span className="min-w-0 flex-1 truncate text-sm text-fg">
                {c.profile_name ?? c.external_id}
              </span>
              <span
                className="shrink-0 text-2xs text-fg-subtle uppercase"
                style={{ fontWeight: 'var(--weight-caps)', letterSpacing: 'var(--tracking-caps)' }}
              >
                {c.channel === 'instagram' ? 'IG' : 'WA'}
              </span>
            </li>
          ))}
          {optedOut.length > 10 && (
            <li className="border-b border-border bg-surface px-4 py-2.5 text-xs text-fg-subtle">
              and {optedOut.length - 10} more
            </li>
          )}
        </ul>
      )}
      </section>
    </div>
  )
}
