import { useState } from 'react'
import { Check, IndianRupee, Sparkles, Target, TrendingUp } from 'lucide-react'
import { EmptyState } from '../../ui/EmptyState'
import { ErrorState } from '../../ui/ErrorState'
import { Skeleton } from '../../ui/Skeleton'
import { formatINRCompact } from '../../ui/formatMoney'

export type RevenueForecastPreview = {
  month: string
  target: number
  closed: number
  committed: number
  bestCase: number
  elapsedPct: number
  stages: { key: string; label: string; rawValue: number; probability: number; weightedValue: number }[]
  sample: true
}

const FORECAST: RevenueForecastPreview = {
  month: 'August', target: 1800000, closed: 720000, committed: 1380000, bestCase: 2040000, elapsedPct: 19, sample: true,
  stages: [
    { key: 'qualified', label: 'Qualified', rawValue: 840000, probability: 35, weightedValue: 294000 },
    { key: 'solution', label: 'Solution fit', rawValue: 610000, probability: 55, weightedValue: 335500 },
    { key: 'commercial', label: 'Commercial', rawValue: 430000, probability: 75, weightedValue: 322500 },
    { key: 'verbal', label: 'Verbal commit', rawValue: 240000, probability: 90, weightedValue: 216000 },
  ],
}

export function ForecastWidget({ previewState = 'ready' }: { previewState?: 'ready' | 'loading' | 'empty' | 'error' }) {
  const [mode, setMode] = useState<'committed' | 'best'>('committed')
  if (previewState === 'loading') return <Skeleton className="h-72" />
  if (previewState === 'empty') return <EmptyState icon={IndianRupee} title="No forecastable pipeline yet." body="Qualified deals with a value will build the forecast here." />
  if (previewState === 'error') return <ErrorState title="Couldn’t load the forecast" body="The last good snapshot remains unchanged. Retry when connected." onRetry={() => undefined} />
  const forecast = mode === 'committed' ? FORECAST.committed : FORECAST.bestCase
  const max = Math.max(...FORECAST.stages.map((stage) => stage.rawValue), 1)
  return <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-elev-2" aria-labelledby="forecast-title"><header className="flex flex-wrap items-end justify-between gap-3 border-b border-border p-4"><div><p className="label-caps text-accent">Revenue forecast · Preview</p><h2 id="forecast-title" className="mt-1 text-lg font-semibold tracking-[-0.025em] text-fg">{formatINRCompact(forecast)} headed for {FORECAST.month}</h2><p className="mt-1 text-xs text-fg-muted">Weighted by stage, shown against closed revenue and target.</p></div><div className="flex rounded-md border border-border bg-surface-sunk p-0.5" role="group" aria-label="Forecast scenario">{(['committed', 'best'] as const).map((item) => <button key={item} onClick={() => setMode(item)} aria-pressed={mode === item} className={['rounded-sm px-3 py-1.5 text-xs font-semibold', mode === item ? 'bg-surface-raised text-fg shadow-elev-1' : 'text-fg-muted'].join(' ')}>{item === 'best' ? 'Best case' : 'Committed'}</button>)}</div></header><div className="grid gap-5 p-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,.75fr)]"><div><svg viewBox="0 0 680 260" className="h-auto w-full" role="img" aria-label="Weighted pipeline by stage">{FORECAST.stages.map((stage, index) => { const y = 18 + index * 56; const rawWidth = (stage.rawValue / max) * 460; const weightedWidth = (stage.weightedValue / max) * 460; return <g key={stage.key}><text x="0" y={y + 22} fill="var(--fg-muted)" fontSize="12" fontWeight="600">{stage.label}</text><rect x="112" y={y + 2} width={rawWidth} height="30" rx="8" fill="var(--surface-sunk)" /><rect x="112" y={y + 2} width={weightedWidth} height="30" rx="8" fill="var(--accent)" /><text x={Math.min(640, 122 + rawWidth)} y={y + 22} fill="var(--fg)" fontSize="11" fontWeight="650">{stage.probability}%</text></g> })}<g transform="translate(112 250)"><circle r="4" fill="var(--accent)" /><text x="10" y="4" fill="var(--fg-muted)" fontSize="10">Weighted</text><circle cx="78" r="4" fill="var(--surface-sunk)" stroke="var(--border-strong)" /><text x="88" y="4" fill="var(--fg-muted)" fontSize="10">Raw pipeline</text></g></svg></div><aside className="rounded-xl bg-surface-sunk p-4"><div className="flex items-center justify-between"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-subtle text-accent"><Target aria-hidden size={17} /></span><span className="label-caps">19% of month</span></div><div className="mt-5 flex items-end justify-between"><span><strong className="tnum block text-2xl text-fg">{formatINRCompact(FORECAST.closed)}</strong><span className="text-2xs text-fg-muted">closed</span></span><span className="text-right"><strong className="tnum block text-lg text-fg">{formatINRCompact(FORECAST.target)}</strong><span className="text-2xs text-fg-muted">target</span></span></div><div className="relative mt-4 h-3 overflow-hidden rounded-pill bg-surface"><div className="h-full rounded-pill bg-success" style={{ width: `${(FORECAST.closed / FORECAST.target) * 100}%` }} /><span className="absolute top-0 bottom-0 w-px bg-warn" style={{ left: `${FORECAST.elapsedPct}%` }} /></div><p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-success"><TrendingUp aria-hidden size={13} /> 21 points ahead of month pace</p><div className="mt-4 rounded-lg bg-surface p-3"><p className="flex items-center gap-1.5 text-2xs font-semibold text-accent"><Sparkles aria-hidden size={12} /> Copilot read</p><p className="mt-2 text-xs leading-relaxed text-fg-muted">Commercial review is the highest-leverage stage: {formatINRCompact(430000)} raw, with two decisions due this week.</p></div><p className="mt-3 flex items-center gap-1 text-2xs text-fg-subtle"><Check aria-hidden size={11} /> Stage weights are visible and editable only in wiring.</p></aside></div></section>
}
