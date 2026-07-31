import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useClient } from '../../shell/ClientProvider'
import { useAuth } from '../../auth/AuthProvider'
import { useQueue, usePreviews } from '../../lib/inbox-data'
import { useFollowUps, useLeads } from '../../lib/leads-data'
import { waitingLongest, dueToday, isOverdue } from '../../lib/landing-data'
import { REP_PLAN, DASH, useMockTodos } from '../../lib/mock-data'
import { Sheet } from '../../ui/Sheet'
import { inrCompact } from '../crm/PipelineStrip'
import { EmptyState } from '../../ui/EmptyState'
import { Skeleton } from '../../ui/Skeleton'
import { SectionHeader, SectionEmpty, ThreadList } from '../landing/LandingSection'
import { ThreadHero } from '../landing/ThreadHero'
import { ActionFeed } from './ActionFeed'

// TODAY — the rep's landing (§1.11): "what do I do next?" still opens with the
// oldest waiting thread, NOT stats. SA-05 (Joyal's ruling 2026-07-30,
// superseding the chart-free-rep line for THIS surface only) adds a compact
// "My month" strip UNDER the action sections: target / sold / to-go /
// incentive. Sold + won are REAL (computed from the same leads read the CRM
// uses, scoped own+unassigned); the plan numbers (target, incentive rates)
// are SAMPLE until targets get a table — marked in the UI.
export function Today() {
  const { activeClient } = useClient()
  const { session } = useAuth()
  const clientId = activeClient?.id ?? null
  const userId = session?.user?.id ?? null

  const { items, loading, error } = useQueue(clientId)
  const { previews } = usePreviews(clientId)
  const { items: followUps } = useFollowUps(clientId)
  const { items: leads } = useLeads(clientId)
  const { items: todos } = useMockTodos()

  const waiting = useMemo(() => waitingLongest(items), [items])
  const [oldest, ...rest] = waiting
  const today = useMemo(() => dueToday(followUps), [followUps])

  // My month — REAL sold/won from the rep's scope (own + unassigned, same
  // rule as the CRM board), current calendar month by lead update.
  const month = useMemo(() => {
    const start = new Date()
    start.setDate(1)
    start.setHours(0, 0, 0, 0)
    const mine = leads.filter(
      (l) => l.conversation?.assigned_to == null || l.conversation.assigned_to === userId,
    )
    const wonThisMonth = mine.filter(
      (l) => l.status === 'won' && new Date(l.updated_at).getTime() >= start.getTime(),
    )
    const sold = wonThisMonth.reduce((a, l) => a + Number(l.est_value ?? 0), 0)
    const toGo = Math.max(0, REP_PLAN.monthlyTargetValue - sold)
    const incentive =
      wonThisMonth.length * REP_PLAN.incentivePerWon +
      (sold >= REP_PLAN.monthlyTargetValue ? REP_PLAN.bonusAtTarget : 0)
    return { wonCount: wonThisMonth.length, sold, toGo, incentive }
  }, [leads, userId])

  const myTodos = useMemo(() => todos.filter((t) => t.status === 'pending').slice(0, 3), [todos])
  const [boardOpen, setBoardOpen] = useState(false)

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

  const targetPct = Math.min(
    100,
    Math.round((month.sold / REP_PLAN.monthlyTargetValue) * 100),
  )

  return (
    <div className="pb-6">
      {/* SA-06 (Joyal): the employee's OWN numbers open the day — the screen
          should feel like progress, then hand them the next action below. */}
      <div className="flex items-baseline gap-2 px-4 pt-5 pb-2">
        <h2
          className="label-caps text-fg-muted"
          style={{ fontWeight: 'var(--weight-caps)', letterSpacing: 'var(--tracking-caps)' }}
        >
          My month
        </h2>
        <button
          onClick={() => setBoardOpen(true)}
          className="ml-auto rounded-pill border border-border px-2.5 py-0.5 text-2xs font-semibold text-fg-muted hover:border-border-strong hover:text-fg"
        >
          Team wins
        </button>
      </div>
      <div className="space-y-3 border-b border-border bg-surface px-4 pb-4">
        {/* Progress toward target — the one accent event on this screen. */}
        <div>
          <div className="flex items-baseline justify-between">
            <span className="tnum text-xs text-fg-muted" style={{ fontFamily: 'var(--font-mono)' }}>
              ₹{inrCompact(month.sold)} of ₹{inrCompact(REP_PLAN.monthlyTargetValue)}
            </span>
            <span className="text-xs font-medium text-fg">
              {targetPct >= 100
                ? 'Target hit — bonus unlocked.'
                : `₹${inrCompact(month.toGo)} to go`}
            </span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-pill bg-surface-sunk">
            <div
              className="h-full rounded-pill bg-accent transition-[width]"
              style={{ width: `${Math.max(targetPct, 2)}%` }}
              role="progressbar"
              aria-valuenow={targetPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Progress toward monthly target"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(
          [
            ['Target', `₹${inrCompact(REP_PLAN.monthlyTargetValue)}`, false],
            ['Sold', `₹${inrCompact(month.sold)}`, false],
            ['To go', month.toGo === 0 ? 'Done' : `₹${inrCompact(month.toGo)}`, false],
            // Neutral tile — the progress bar above already holds this
            // screen's one accent (§1.7).
            ['Incentive', `₹${inrCompact(month.incentive)}`, false],
          ] as const
        ).map(([label, value, accent]) => (
          <div key={label} className="rounded-md border border-border bg-canvas px-3 py-2.5">
            <div
              className="text-2xs text-fg-subtle uppercase"
              style={{ fontWeight: 'var(--weight-caps)', letterSpacing: 'var(--tracking-caps)' }}
            >
              {label}
            </div>
            <div
              className={['tnum mt-0.5 text-lg leading-none', accent ? 'text-accent' : 'text-fg'].join(' ')}
              style={{
                fontFamily: 'var(--font-mono)',
                fontWeight: 'var(--weight-num)',
                letterSpacing: 'var(--tracking-tight)',
              }}
            >
              {value}
            </div>
          </div>
        ))}
        </div>
        <p className="text-2xs text-fg-subtle">
          Sold and won are live from your leads. Target and incentive amounts are sample until
          targets go live.
        </p>
      </div>

      {/* UI-BUILD-02: next-best-action feed (mock) — the day's queue with reasons. */}
      <ActionFeed />

      {/* Todos from the manager — SAMPLE (employee_todos, Wave 1). */}
      <SectionHeader title="Todos" count={myTodos.length} hint="Sample — todos aren't saved yet" />
      {myTodos.length === 0 ? (
        <SectionEmpty>Nothing assigned.</SectionEmpty>
      ) : (
        <ul>
          {myTodos.map((t) => (
            <li
              key={t.id}
              className="flex items-baseline gap-3 border-b border-border bg-surface px-4 py-3"
            >
              <span
                className={[
                  'tnum shrink-0 text-2xs uppercase',
                  new Date(t.due_at).getTime() < Date.now() ? 'text-danger' : 'text-fg-subtle',
                ].join(' ')}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 'var(--weight-caps)',
                  letterSpacing: 'var(--tracking-caps)',
                }}
              >
                {new Date(t.due_at).getTime() < Date.now() ? 'Late' : 'Due'}
              </span>
              <span className="min-w-0 flex-1 text-sm text-fg">{t.title}</span>
            </li>
          ))}
          <li className="border-b border-border bg-surface px-4 py-2">
            <Link to="/leads?tab=todos" className="text-xs text-fg-muted hover:text-fg">
              All todos →
            </Link>
          </li>
        </ul>
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

      {/* The queue — below the numbers (Joyal's order), still one tap away. */}
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

      {/* Team wins — healthy comparison: celebrate closes, no last-place
          shaming, own target progress stays the primary frame. SAMPLE until
          per-rep attribution exists. */}
      <Sheet open={boardOpen} onClose={() => setBoardOpen(false)} title="Team wins this month">
        <div className="space-y-3">
          <p className="text-xs text-fg-muted">
            Every close counts. Sample numbers until team tracking goes live.
          </p>
          {[...DASH.reps]
            .sort((a, b) => b.won - a.won)
            .map((r, i) => (
              <div key={r.name} className="flex items-center gap-3">
                <span
                  className="tnum w-5 shrink-0 text-sm text-fg-subtle"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-fg">{r.name}</span>
                {i === 0 && (
                  <span
                    className="shrink-0 text-2xs text-accent uppercase"
                    style={{ fontWeight: 'var(--weight-caps)', letterSpacing: 'var(--tracking-caps)' }}
                  >
                    Top closer
                  </span>
                )}
                <span
                  className="tnum shrink-0 text-sm text-fg"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  {r.won} won
                </span>
              </div>
            ))}
        </div>
      </Sheet>
    </div>
  )
}
