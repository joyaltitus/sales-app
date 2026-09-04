import { IndianRupee, Target } from 'lucide-react'
import { EmptyState } from '../../ui/EmptyState'
import { ErrorState } from '../../ui/ErrorState'
import { Skeleton } from '../../ui/Skeleton'
import { formatINRCompact } from '../../ui/formatMoney'
import type { MetricsResponse } from '../../lib/metrics-data'

// WIRE-B2/S10 + Amendment H.5: stages/committed total are real, from the same
// GET /api/metrics snapshot DashboardScreen already fetched (threaded down as a
// prop — no second request). `target`/`bestCase`/scenario toggle had no schema
// backing (no employee_targets-by-window join, no "best case" concept anywhere)
// and are dropped rather than fabricated — they land with the owner-report
// follow-on (WIRE-B3) if a real comparator shows up there. Per H.5: probability
// EXPLANATIONS stay deferred — `probability` is shown as a plain number with an
// "Estimated" label, no drilldown UI (that pattern lives elsewhere, in
// DealProbability/ProbabilityExplanation, out of scope here).
export function ForecastWidget({
  metrics,
  loading = false,
}: {
  metrics?: MetricsResponse | null
  loading?: boolean
}) {
  if (loading) return <Skeleton className="h-72" />
  const stages = metrics?.pipeline_stage_weighted ?? []
  if (!metrics) {
    return (
      <ErrorState
        title="Couldn’t load the forecast"
        body="The last good snapshot remains unchanged. Retry when connected."
        onRetry={() => undefined}
      />
    )
  }
  if (stages.length === 0) {
    return (
      <EmptyState
        icon={IndianRupee}
        title="No forecastable pipeline yet."
        body="Qualified deals with a value will build the forecast here."
      />
    )
  }
  const max = Math.max(...stages.map((stage) => stage.raw_value), 1)
  return (
    <section
      className="overflow-hidden rounded-xl border border-border bg-surface shadow-elev-2"
      aria-labelledby="forecast-title"
    >
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border p-4">
        <div>
          <p className="text-xs font-medium text-accent">Revenue forecast · Estimated</p>
          <h2 id="forecast-title" className="mt-1 text-lg font-semibold tracking-[-0.025em] text-fg">
            {formatINRCompact(metrics.pipeline_weighted_total)} weighted pipeline
          </h2>
          <p className="mt-1 text-xs text-fg-muted">
            Weighted by stage — each stage's raw value × its configured weight. Stage weights come
            from your workspace configuration.
          </p>
        </div>
      </header>
      <div className="p-4">
        <svg viewBox="0 0 680 260" className="h-auto w-full" role="img" aria-label="Weighted pipeline by stage">
          {stages.map((stage, index) => {
            const y = 18 + index * 56
            const rawWidth = (stage.raw_value / max) * 460
            const weightedWidth = (stage.weighted_value / max) * 460
            return (
              <g key={stage.stage_id}>
                <text x="0" y={y + 22} fill="var(--fg-muted)" fontSize="12" fontWeight="600">
                  {stage.label}
                </text>
                <rect x="112" y={y + 2} width={rawWidth} height="30" rx="8" fill="var(--surface-sunk)" />
                <rect x="112" y={y + 2} width={weightedWidth} height="30" rx="8" fill="var(--accent)" />
                <text x={Math.min(640, 122 + rawWidth)} y={y + 22} fill="var(--fg)" fontSize="11" fontWeight="650">
                  {Math.round(stage.weight * 100)}%
                </text>
              </g>
            )
          })}
          <g transform="translate(112 250)">
            <circle r="4" fill="var(--accent)" />
            <text x="10" y="4" fill="var(--fg-muted)" fontSize="10">
              Weighted
            </text>
            <circle cx="78" r="4" fill="var(--surface-sunk)" stroke="var(--border-strong)" />
            <text x="88" y="4" fill="var(--fg-muted)" fontSize="10">
              Raw pipeline
            </text>
          </g>
        </svg>
        <p className="mt-3 flex items-center gap-1.5 text-2xs text-fg-subtle">
          <Target aria-hidden size={11} /> Percentages are each stage's weight — an estimate, not a
          modeled win probability.
        </p>
      </div>
    </section>
  )
}
