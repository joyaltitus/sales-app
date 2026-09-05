import { useMemo } from 'react'
import type { LeadItem, LeadStage } from '../../lib/leads-data'
import { formatINRCompact } from '../../ui/formatMoney'

// The pipeline value strip — the board's own numbers over the REAL leads the
// screen already fetched. Same type signature as the queue's wait stamps:
// huge-and-tight mono numerals over tiny-and-wide micro-caps labels (§1.6).
// Clicking a stage filters the board to it; clicking again clears. This is a
// stat strip on a working surface, not a landing stat-card grid — the §1.10
// lift (2026-07-30 ruling) applies to manager/admin CRM only, and this
// component is only mounted there.

const numStyle = {
  fontFamily: 'var(--font-mono)',
  fontWeight: 'var(--weight-num)',
  letterSpacing: 'var(--tracking-tight)',
} as const

export function PipelineStrip({
  stages,
  items,
  activeStageId,
  onStageClick,
}: {
  stages: LeadStage[]
  items: LeadItem[]
  activeStageId: string | null
  onStageClick: (stageId: string) => void
}) {
  const byStage = useMemo(() => {
    const m = new Map<string, { count: number; value: number }>()
    for (const s of stages) m.set(s.id, { count: 0, value: 0 })
    let won = 0
    let lost = 0
    for (const lead of items) {
      if (lead.status === 'won') won++
      if (lead.status === 'lost') lost++
      const cell = m.get(lead.stage_id)
      if (!cell) continue
      cell.count++
      if (lead.status !== 'lost') cell.value += Number(lead.est_value ?? 0)
    }
    const decided = won + lost
    return { m, winRate: decided > 0 ? Math.round((won / decided) * 100) : null, won, lost }
  }, [stages, items])

  return (
    <div className="no-scrollbar flex gap-2 overflow-x-auto pb-0.5" role="group" aria-label="Pipeline by stage">
      {stages.map((s) => {
        const cell = byStage.m.get(s.id) ?? { count: 0, value: 0 }
        const active = activeStageId === s.id
        return (
          <button
            key={s.id}
            onClick={() => onStageClick(s.id)}
            aria-pressed={active}
            className={[
              'flex min-w-[5.5rem] shrink-0 flex-col items-start rounded-lg border px-3 py-2.5 text-left shadow-elev-1 transition-[background-color,border-color,transform]',
              active
                ? 'border-accent bg-accent-subtle'
                : 'border-border bg-surface hover:-translate-y-px hover:border-border-strong',
            ].join(' ')}
          >
            <span
              className={['text-2xs font-medium', active ? 'text-accent' : 'text-fg-subtle'].join(' ')}
            >
              {s.label}
            </span>
            <span className="mt-0.5 flex items-baseline gap-1.5">
              <span
                className={['tnum text-lg leading-none', active ? 'text-accent' : 'text-fg'].join(' ')}
                style={numStyle}
              >
                {cell.count}
              </span>
              {cell.value > 0 && (
                <span className="tnum text-2xs text-fg-subtle" style={{ fontFamily: 'var(--font-mono)' }}>
                  {formatINRCompact(cell.value)}
                </span>
              )}
            </span>
          </button>
        )
      })}

      {/* Win rate — derived from decided leads only; dash until one decides. */}
      <div className="flex min-w-[5.5rem] shrink-0 flex-col items-start rounded-lg border border-border bg-surface-sunk px-3 py-2.5">
        <span className="text-2xs font-medium text-fg-muted">
          Win rate
        </span>
        <span className="mt-0.5 flex items-baseline gap-1.5">
          <span className="tnum text-lg leading-none text-fg" style={numStyle}>
            {byStage.winRate == null ? '—' : `${byStage.winRate}%`}
          </span>
          {byStage.winRate != null && (
            <span className="tnum text-2xs text-fg-muted" style={{ fontFamily: 'var(--font-mono)' }}>
              {byStage.won}W {byStage.lost}L
            </span>
          )}
        </span>
      </div>
    </div>
  )
}
