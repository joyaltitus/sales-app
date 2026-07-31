import { Button } from '../../ui/Button'
import { SampleTag, StatusBadge } from '../../ui/agent/primitives'
import { MOCK_MANAGER } from '../../lib/mock-wave3'

// Manager intelligence (mock) — operational and supportive: risks with names
// and reasons, coaching as pairing suggestions, patterns as plain sentences.
// Deliberately NOT a surveillance board: no per-rep ranking table, no red
// walls, no public shame.

function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-md border border-border bg-surface p-3.5 shadow-elev-1">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-fg">{title}</h3>
        {action}
      </div>
      <div className="mt-2">{children}</div>
    </section>
  )
}

export function ManagerIntel() {
  const m = MOCK_MANAGER
  const max = Math.max(...m.pipelineHealth.map((s) => s.count))

  return (
    <div className="space-y-3 px-4 py-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-fg">This month, honestly</h2>
        <SampleTag label="Preview — not wired" />
      </div>

      {/* Forecast + health numbers */}
      <div className="tnum grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          [
            ['Forecast', m.forecast.month],
            ['Confident', m.forecast.confident],
            ['Follow-up done', `${Math.round(m.followUpCompletion * 100)}%`],
            ['Median reply', `${m.medianResponseMin}m`],
          ] as const
        ).map(([l, v]) => (
          <div key={l} className="rounded-md border border-border bg-surface px-3 py-2.5 shadow-elev-1">
            <div className="label-caps">{l}</div>
            <div className="mt-1 text-lg leading-none font-semibold text-fg" style={{ fontFamily: 'var(--font-mono)' }}>
              {v}
            </div>
          </div>
        ))}
      </div>

      <Card title="Pipeline health">
        <div className="space-y-1.5">
          {m.pipelineHealth.map((s) => (
            <div key={s.stage} className="flex items-center gap-2 text-xs">
              <span className="w-16 shrink-0 text-fg-muted">{s.stage}</span>
              <span className="h-3 rounded-[3px] bg-chart-ink" style={{ width: `${(s.count / max) * 60}%` }} />
              <span className="tnum text-fg">{s.count}</span>
              {s.risk > 0 && <span className="text-2xs text-warn">{s.risk} at risk</span>}
            </div>
          ))}
        </div>
        <p className="mt-2 text-2xs text-fg-muted">
          {m.rescued} deals rescued from neglect this month.
        </p>
      </Card>

      <Card title="At-risk deals">
        <div className="space-y-2">
          {m.atRisk.map((d) => (
            <div key={d.customer} className="flex items-start justify-between gap-2 border-b border-border pb-2 last:border-0 last:pb-0">
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-fg">{d.customer}</p>
                <p className="text-2xs text-fg-muted">{d.why}</p>
              </div>
              <span className="tnum shrink-0 text-xs text-fg">{d.value}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Coaching">
        <div className="space-y-2">
          {m.coaching.map((c) => (
            <p key={c.who} className="text-xs text-fg-muted">
              <span className="font-medium text-fg">{c.who}</span> — {c.note}
            </p>
          ))}
        </div>
        <p className="mt-2 rounded-sm bg-accent-subtle px-2.5 py-1.5 text-2xs text-fg">
          Pattern: {m.winning}
        </p>
      </Card>

      <Card
        title="Why deals were lost"
        action={<Button size="sm" variant="ghost" className="h-7 px-2 text-2xs">Review threads</Button>}
      >
        <div className="flex flex-wrap gap-1.5">
          {m.lostReasons.map((r) => (
            <StatusBadge key={r.reason} tone="neutral">
              {r.reason} · {r.count}
            </StatusBadge>
          ))}
        </div>
      </Card>
    </div>
  )
}
