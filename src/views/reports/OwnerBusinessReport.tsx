import { useState } from 'react'
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  CalendarCheck,
  Check,
  Download,
  IndianRupee,
  MessageSquareText,
  Printer,
  Target,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '../../ui/Button'
import { EmptyState } from '../../ui/EmptyState'
import { ErrorState } from '../../ui/ErrorState'
import { ProductMark } from '../../ui/ProductMark'
import { Skeleton } from '../../ui/Skeleton'
import { formatINRCompact } from '../../ui/formatMoney'
import { OWNER_REPORTS } from './ownerReportMocks'
import type { OwnerReportPeriod, OwnerReportPreview } from './ownerReportMocks'

type PreviewState = 'ready' | 'loading' | 'empty' | 'error'
type DeltaTone = 'positive' | 'negative' | 'neutral'

function percentDelta(current: number, prior: number) {
  return prior === 0 ? 0 : Math.round(((current - prior) / prior) * 100)
}

function Delta({ value, suffix = '%', tone }: { value: number; suffix?: string; tone: DeltaTone }) {
  const Icon = value >= 0 ? ArrowUpRight : ArrowDownRight
  const className = tone === 'positive' ? 'text-success' : tone === 'negative' ? 'text-danger' : 'text-fg-muted'
  return <span className={['inline-flex items-center gap-0.5 text-2xs font-semibold', className].join(' ')}><Icon aria-hidden size={12} />{Math.abs(value)}{suffix}</span>
}

function ExecutiveMetric({ icon: Icon, label, value, detail, delta, deltaSuffix = '%', tone = 'positive' }: { icon: LucideIcon; label: string; value: string; detail: string; delta: number; deltaSuffix?: string; tone?: DeltaTone }) {
  return (
    <article className="owner-report-metric border-t-2 border-fg bg-surface px-4 py-4">
      <div className="flex items-center justify-between gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-md bg-surface-sunk text-fg-muted"><Icon aria-hidden size={15} /></span><Delta value={delta} suffix={deltaSuffix} tone={tone} /></div>
      <p className="label-caps mt-4">{label}</p>
      <strong className="tnum mt-1 block text-2xl leading-none tracking-[-0.045em] text-fg">{value}</strong>
      <p className="mt-2 text-2xs leading-relaxed text-fg-muted">{detail}</p>
    </article>
  )
}

function RevenuePaceChart({ report }: { report: OwnerReportPreview }) {
  const values = report.revenue.weeklyClosed
  const targets = report.revenue.weeklyTarget
  const max = Math.max(...values, ...targets, 1)
  const slot = 88 / values.length
  return (
    <div>
      <svg viewBox="0 0 520 205" className="h-52 w-full" role="img" aria-label={`Revenue closed by ${report.period === 'month' ? 'week' : 'day'} with target pace`}>
        {[0, 1, 2, 3].map((line) => <line key={line} x1="36" x2="510" y1={25 + line * 42} y2={25 + line * 42} stroke="var(--border)" strokeWidth="1" />)}
        {values.map((value, index) => {
          const height = (value / max) * 135
          const targetY = 170 - (targets[index] / max) * 135
          const x = 45 + index * slot * 5.2
          return <g key={index}><rect x={x} y={170 - height} width={Math.max(24, slot * 3)} height={height} rx="4" fill="var(--accent)" /><line x1={x - 4} x2={x + Math.max(24, slot * 3) + 4} y1={targetY} y2={targetY} stroke="var(--fg)" strokeWidth="2" strokeDasharray="4 4" /><text x={x + Math.max(24, slot * 3) / 2} y="194" textAnchor="middle" fill="var(--fg-muted)" fontSize="11">{report.period === 'month' ? `W${index + 1}` : ['M', 'T', 'W', 'T', 'F'][index]}</text></g>
        })}
      </svg>
      <div className="flex flex-wrap gap-4 text-2xs text-fg-muted"><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-xs bg-accent" /> Closed</span><span className="flex items-center gap-1.5"><i className="w-4 border-t-2 border-dashed border-fg" /> Target pace</span></div>
    </div>
  )
}

function PipelineChart({ report }: { report: OwnerReportPreview }) {
  const max = Math.max(...report.pipeline.stages.map((stage) => stage.value), 1)
  return (
    <div className="space-y-4 pt-2">
      {report.pipeline.stages.map((stage, index) => <div key={stage.label}><div className="mb-1.5 flex items-center justify-between gap-3 text-xs"><span className="font-medium text-fg">{stage.label}</span><strong className="tnum text-fg">{formatINRCompact(stage.value)}</strong></div><div className="h-3 overflow-hidden rounded-sm bg-surface-sunk"><div className="h-full rounded-sm" style={{ width: `${(stage.value / max) * 100}%`, background: index === report.pipeline.stages.length - 1 ? 'var(--signal)' : 'var(--chart-ink)' }} /></div></div>)}
    </div>
  )
}

function ObjectionSpark({ values }: { values: number[] }) {
  const max = Math.max(...values, 1)
  const points = values.map((value, index) => `${(index / Math.max(1, values.length - 1)) * 76 + 2},${30 - (value / max) * 24}`).join(' ')
  return <svg viewBox="0 0 80 34" className="h-8 w-20" role="img" aria-label={`Trend ${values.join(', ')}`}><polyline points={points} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" /></svg>
}

function ReportContent({ report }: { report: OwnerReportPreview }) {
  const revenueProgress = Math.round((report.revenue.closed / report.revenue.target) * 100)
  const revenueDelta = percentDelta(report.revenue.closed, report.revenue.priorClosed)
  const bookingDelta = percentDelta(report.bookings.total, report.bookings.priorTotal)
  const activityDelta = percentDelta(report.activity.conversationsHandled, report.activity.conversationsPrior)
  return (
    <>
      <section className="owner-report-readout grid gap-4 border-y border-border py-5 lg:grid-cols-[1fr_0.9fr]">
        <div><p className="label-caps text-accent">Owner readout</p><h3 className="mt-2 text-xl font-semibold leading-tight tracking-[-0.035em] text-fg">{report.readout}</h3></div>
        <div className="rounded-lg border border-warn/25 bg-warn-subtle p-4"><p className="label-caps text-warn">Decision to watch</p><p className="mt-2 text-sm font-semibold leading-relaxed text-fg">{report.nextDecision}</p></div>
      </section>

      <section className="owner-report-metrics grid overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-4" aria-label="Business summary metrics">
        <ExecutiveMetric icon={IndianRupee} label="Revenue closed" value={formatINRCompact(report.revenue.closed)} detail={`${revenueProgress}% of ${formatINRCompact(report.revenue.target)} target`} delta={revenueDelta} />
        <ExecutiveMetric icon={Target} label="Pipeline" value={formatINRCompact(report.pipeline.value)} detail={`${report.pipeline.coverage.toFixed(1)}× target coverage`} delta={Math.round((report.pipeline.coverage - report.pipeline.priorCoverage) * 10) / 10} deltaSuffix="×" />
        <ExecutiveMetric icon={MessageSquareText} label="Conversations" value={String(report.activity.conversationsHandled)} detail={`${report.activity.onTimePct}% follow-ups on time`} delta={activityDelta} />
        <ExecutiveMetric icon={CalendarCheck} label="Bookings" value={String(report.bookings.total)} detail={`${report.bookings.attendedPct}% attended`} delta={bookingDelta} />
      </section>

      <section className="owner-report-charts grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-lg border border-border bg-surface p-4"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="label-caps">Revenue pace</p><h3 className="mt-1 text-md font-semibold text-fg">{formatINRCompact(report.revenue.closed)} closed</h3></div><span className="tnum text-xs font-semibold text-fg-muted">Target {formatINRCompact(report.revenue.target)}</span></div><RevenuePaceChart report={report} /></article>
        <article className="rounded-lg border border-border bg-surface p-4"><div><p className="label-caps">Pipeline by stage</p><h3 className="mt-1 text-md font-semibold text-fg">{report.pipeline.coverage.toFixed(1)}× coverage</h3><p className="mt-1 text-2xs text-fg-muted">Current open value, not weighted.</p></div><PipelineChart report={report} /></article>
      </section>

      <section className="owner-report-tables grid gap-4 lg:grid-cols-[1fr_1.15fr]">
        <article className="overflow-hidden rounded-lg border border-border bg-surface"><div className="border-b border-border p-4"><p className="label-caps">Team activity</p><h3 className="mt-1 text-md font-semibold text-fg">Healthy execution, in context</h3></div><table className="w-full border-collapse text-xs"><thead><tr className="border-b border-border bg-surface-sunk text-fg-muted"><th scope="col" className="px-4 py-2 text-left font-semibold">Measure</th><th scope="col" className="px-3 py-2 text-right font-semibold">This period</th><th scope="col" className="px-4 py-2 text-right font-semibold">Prior</th></tr></thead><tbody>{[
          ['Conversations handled', report.activity.conversationsHandled, report.activity.conversationsPrior, 'number'],
          ['Follow-ups completed', report.activity.followUpsCompleted, report.activity.followUpsPrior, 'number'],
          ['Follow-ups on time', report.activity.onTimePct, report.activity.priorOnTimePct, 'percent'],
          ['Booking attendance', report.bookings.attendedPct, report.bookings.priorAttendedPct, 'percent'],
        ].map(([label, current, prior, format]) => <tr key={String(label)} className="border-b border-border last:border-0"><th scope="row" className="px-4 py-3 text-left font-medium text-fg">{label}</th><td className="tnum px-3 py-3 text-right font-semibold text-fg">{current}{format === 'percent' ? '%' : ''}</td><td className="tnum px-4 py-3 text-right text-fg-muted">{prior}{format === 'percent' ? '%' : ''}</td></tr>)}</tbody></table></article>
        <article className="overflow-hidden rounded-lg border border-border bg-surface"><div className="border-b border-border p-4"><p className="label-caps">Top objections</p><h3 className="mt-1 text-md font-semibold text-fg">What buyers are pushing back on</h3></div><table className="w-full border-collapse text-xs"><thead><tr className="border-b border-border bg-surface-sunk text-fg-muted"><th scope="col" className="px-4 py-2 text-left font-semibold">Objection</th><th scope="col" className="px-2 py-2 text-right font-semibold">Trend</th><th scope="col" className="px-2 py-2 text-right font-semibold">Count</th><th scope="col" className="px-4 py-2 text-right font-semibold">Won after script</th></tr></thead><tbody>{report.objections.map((objection) => { const delta = percentDelta(objection.count, objection.priorCount); return <tr key={objection.label} className="border-b border-border last:border-0"><th scope="row" className="px-4 py-3 text-left font-medium text-fg">{objection.label}</th><td className="px-2 py-2"><div className="flex justify-end"><ObjectionSpark values={objection.series} /></div></td><td className="tnum px-2 py-3 text-right"><strong className="text-fg">{objection.count}</strong><div><Delta value={delta} tone={delta <= 0 ? 'positive' : 'negative'} /></div></td><td className="tnum px-4 py-3 text-right font-semibold text-fg">{objection.wonAfterScriptPct}%</td></tr> })}</tbody></table></article>
      </section>
    </>
  )
}

export default function OwnerBusinessReport({ previewState = 'ready' }: { previewState?: PreviewState }) {
  const [period, setPeriod] = useState<OwnerReportPeriod>('month')
  const [shareReady, setShareReady] = useState(false)
  const [printPreview, setPrintPreview] = useState(false)
  const report = OWNER_REPORTS[period]

  if (previewState === 'loading') return <section className="space-y-3 rounded-xl border border-border bg-surface p-5" aria-label="Loading business report"><Skeleton className="h-20" /><div className="grid gap-3 sm:grid-cols-4"><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" /></div><Skeleton className="h-72" /></section>
  if (previewState === 'empty') return <section className="rounded-xl border border-border bg-surface"><EmptyState icon={Activity} title="Your first business report is taking shape." body="Closed revenue, pipeline and bookings will appear after the first complete reporting period." /></section>
  if (previewState === 'error') return <section className="rounded-xl border border-border bg-surface"><ErrorState title="Couldn’t prepare the business report" body="The operating dashboard is still available. Retry before sharing this period’s summary." onRetry={() => undefined} /></section>

  return (
    <section className={['owner-report rounded-xl border border-border bg-surface-raised p-4 shadow-elev-2 sm:p-6', printPreview ? 'owner-report-print-preview' : ''].join(' ')} aria-labelledby="owner-report-title">
      <header className="owner-report-header flex flex-wrap items-start justify-between gap-5">
        <div className="flex items-start gap-3"><ProductMark size={42} /><div><p className="label-caps text-accent">Business report · Sample</p><h2 id="owner-report-title" className="mt-1 text-2xl font-semibold tracking-[-0.045em] text-fg">The business, at a glance.</h2><p className="mt-1 text-xs text-fg-muted">{report.label} · {report.range} · {report.comparisonLabel}</p></div></div>
        <div className="owner-report-actions flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border border-border bg-surface-sunk p-0.5" role="group" aria-label="Owner report period">
            {(['week', 'month'] as OwnerReportPeriod[]).map((item) => <button key={item} type="button" onClick={() => { setPeriod(item); setShareReady(false) }} aria-pressed={period === item} className={['min-h-8 rounded-sm px-3 text-2xs font-semibold capitalize', period === item ? 'bg-surface-raised text-fg shadow-elev-1' : 'text-fg-muted hover:text-fg'].join(' ')}>{item}</button>)}
          </div>
          <Button size="sm" variant="secondary" onClick={() => setPrintPreview((value) => !value)} aria-pressed={printPreview}><Printer aria-hidden size={14} /> Print preview</Button>
          <Button size="sm" onClick={() => setShareReady(true)}><Download aria-hidden size={14} /> Share as PDF</Button>
        </div>
      </header>
      {shareReady && <div className="owner-report-actions mt-4 flex items-center gap-2 rounded-lg border border-success/25 bg-success-subtle px-3 py-2 text-xs font-semibold text-success" role="status"><Check aria-hidden size={14} /> PDF handoff preview is ready. No file was created or shared.</div>}
      {printPreview && <p className="owner-report-actions mt-3 text-2xs font-semibold text-fg-muted">A4 print preview active — navigation and controls are removed in the real print stylesheet.</p>}
      <div className="mt-6 space-y-4"><ReportContent report={report} /></div>
      <footer className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4 text-2xs text-fg-subtle"><span>Prepared {report.generatedAt}</span><span>Preview — not wired · Figures are illustrative</span></footer>
    </section>
  )
}
