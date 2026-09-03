import { useState } from 'react'
import {
  Activity,
  CalendarCheck,
  Check,
  Download,
  IndianRupee,
  MessageSquareText,
  Printer,
  Target,
  TrendingUp,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useClient } from '../../shell/ClientProvider'
import { useCampaignRoi } from '../../lib/attribution-data'
import type { CampaignRoi } from '../../lib/attribution-data'
import { useMetrics } from '../../lib/metrics-data'
import type { MetricsResponse, MetricsWindow } from '../../lib/metrics-data'
import { firstOfMonth, useTeamTargets } from '../../lib/targets-data'
import { Button } from '../../ui/Button'
import { EmptyState } from '../../ui/EmptyState'
import { ErrorState } from '../../ui/ErrorState'
import { ProductMark } from '../../ui/ProductMark'
import { Skeleton } from '../../ui/Skeleton'
import { formatINR, formatINRCompact } from '../../ui/formatMoney'

// The owner readout — S2-E2 replaced the demock empty state, and the sample
// figures behind it, with the numbers the tenant already has:
//
//   campaign_roi_v  spend against what it bought (070, security_invoker,
//                   manager|client_admin guard INSIDE the view)
//   GET /api/metrics  pipeline by stage, won-by-source revenue, conversation
//                   volume, follow-up compliance, objections
//   employee_targets  the month's target line
//
// What is NOT here is as deliberate as what is. There are no period-over-period
// deltas: /api/metrics takes a window and offers no prior-window comparator, so
// every arrow on this page would have been invented. The dashboard's
// AnalyticsKpi made the same call for the same reason. There is no revenue-pace
// chart either — a per-week series needs a rollup nothing serves yet. A number
// this page cannot source is absent, never estimated.
//
// Money: won_by_source and the pipeline arrive in RUPEES (they are built from
// leads.est_value); campaign_roi_v arrives in MINOR units (paise, straight from
// payment_orders). The two are never added together, and each is divided at the
// edge exactly once.

type OwnerReportPeriod = 'week' | 'month'
const WINDOW: Record<OwnerReportPeriod, MetricsWindow> = { week: '7d', month: '30d' }

/** Minor units at the edge, once. NULL is not zero — 070 returns unknown rather
 *  than dividing by a zero denominator, and a cost per lead of ₹0 on a campaign
 *  that produced nothing is the exact wrong story. */
function money(minor: number | null): string {
  return minor === null || minor === undefined ? '—' : formatINR(minor / 100)
}

function Metric({ icon: Icon, label, value, detail }: { icon: LucideIcon; label: string; value: string; detail: string }) {
  return (
    <article className="owner-report-metric border-t-2 border-fg bg-surface px-4 py-4">
      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-surface-sunk text-fg-muted"><Icon aria-hidden size={15} /></span>
      <p className="label-caps mt-4">{label}</p>
      <strong className="tnum mt-1 block text-2xl leading-none tracking-[-0.045em] text-fg">{value}</strong>
      <p className="mt-2 text-2xs leading-relaxed text-fg-muted">{detail}</p>
    </article>
  )
}

function PipelineChart({ stages }: { stages: MetricsResponse['pipeline_stage_weighted'] }) {
  const max = Math.max(...stages.map((stage) => stage.raw_value), 1)
  return (
    <div className="space-y-4 pt-2">
      {stages.map((stage, index) => (
        <div key={stage.stage_id}>
          <div className="mb-1.5 flex items-center justify-between gap-3 text-xs"><span className="font-medium text-fg">{stage.label}</span><strong className="tnum text-fg">{formatINRCompact(stage.raw_value)}</strong></div>
          <div className="h-3 overflow-hidden rounded-sm bg-surface-sunk"><div className="h-full rounded-sm" style={{ width: `${(stage.raw_value / max) * 100}%`, background: index === stages.length - 1 ? 'var(--signal)' : 'var(--chart-ink)' }} /></div>
        </div>
      ))}
    </div>
  )
}

function RoiTable({ rows }: { rows: CampaignRoi[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-xs">
        <thead><tr className="border-b border-border bg-surface-sunk text-fg-muted">
          <th scope="col" className="px-4 py-2 text-left font-semibold">Campaign</th>
          <th scope="col" className="px-3 py-2 text-right font-semibold">Spend</th>
          <th scope="col" className="px-3 py-2 text-right font-semibold">Leads</th>
          <th scope="col" className="px-3 py-2 text-right font-semibold">Won</th>
          <th scope="col" className="px-3 py-2 text-right font-semibold">Revenue</th>
          <th scope="col" className="px-4 py-2 text-right font-semibold">Cost / sale</th>
        </tr></thead>
        <tbody>{rows.map((row) => (
          <tr key={row.campaign_id} className="border-b border-border last:border-0">
            <th scope="row" className="px-4 py-3 text-left font-medium text-fg">{row.name}<span className="mt-0.5 block text-2xs font-normal text-fg-subtle">{row.channel}</span></th>
            <td className="tnum px-3 py-3 text-right text-fg">{money(row.spend_minor)}</td>
            <td className="tnum px-3 py-3 text-right text-fg">{row.leads}</td>
            <td className="tnum px-3 py-3 text-right text-fg">{row.won}</td>
            <td className="tnum px-3 py-3 text-right font-semibold text-fg">{money(row.revenue_minor)}</td>
            <td className="tnum px-4 py-3 text-right text-fg-muted">{money(row.cost_per_won_minor)}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  )
}

export type OwnerReportPreview = { metrics?: MetricsResponse; roi?: CampaignRoi[]; targetValue?: number }

export default function OwnerBusinessReport({ preview }: { preview?: OwnerReportPreview } = {}) {
  const [period, setPeriod] = useState<OwnerReportPeriod>('month')
  const [shareReady, setShareReady] = useState(false)
  const [printPreview, setPrintPreview] = useState(false)

  const { activeClient } = useClient()
  const clientId = preview ? null : (activeClient?.id ?? null)
  const { data, loading, error } = useMetrics(WINDOW[period], clientId)
  const roi = useCampaignRoi(clientId)
  const { items: targets } = useTeamTargets(clientId, firstOfMonth())

  const metrics = preview?.metrics ?? data
  const roiRows = preview?.roi ?? roi.items
  // The month's target is the sum of what every rep was set — the only target
  // this schema holds. A team with no targets set has no target line, which is
  // the truth; the alternative is a denominator nobody agreed to.
  const target = preview?.targetValue ?? targets.reduce((sum, row) => sum + Number(row.target_value ?? 0), 0)

  if (!preview && !clientId) {
    return <section className="rounded-xl border border-border bg-surface"><EmptyState icon={Activity} title="No workspace" body="Pick a workspace to see its business report." /></section>
  }
  if (!preview && loading) {
    return <section className="space-y-3 rounded-xl border border-border bg-surface p-5" aria-label="Loading business report"><Skeleton className="h-20" /><div className="grid gap-3 sm:grid-cols-4"><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" /></div><Skeleton className="h-72" /></section>
  }
  if (!preview && (error || !metrics)) {
    return <section className="rounded-xl border border-border bg-surface"><ErrorState title="Couldn’t prepare the business report" body="The operating dashboard is still available. Retry before sharing this period’s summary." onRetry={() => setPeriod((value) => value)} /></section>
  }
  if (!metrics) return null

  // `won_by_source` is NULL (not omitted) for a caller hub-service walls, and []
  // when nothing was won. Rendering the first as ₹0 closed would report a wall
  // as a bad month. No shell paints a link here for such a role today, but the
  // response shape allows it, so the page says so rather than inventing a zero.
  if (metrics.won_by_source === null) {
    return (
      <section className="rounded-xl border border-border bg-surface">
        <EmptyState icon={Activity} title="The business report is a manager view" body="Revenue by source and objections are not part of what your role can see." />
      </section>
    )
  }
  const wonBySource = metrics.won_by_source
  const closed = wonBySource.reduce((sum, row) => sum + Number(row.amount ?? 0), 0)
  const wonCount = wonBySource.reduce((sum, row) => sum + Number(row.won_count ?? 0), 0)
  const stages = metrics.pipeline_stage_weighted ?? []
  const pipelineValue = stages.reduce((sum, stage) => sum + Number(stage.raw_value ?? 0), 0)
  const conversations = (metrics.volume_by_channel ?? []).reduce((sum, day) => sum + day.whatsapp + day.instagram, 0)
  const compliance = metrics.follow_up_compliance
  const doneTotal = compliance ? compliance.done_on_time + compliance.done_late : 0
  const onTimePct = doneTotal > 0 ? Math.round((compliance!.done_on_time / doneTotal) * 100) : null
  const objections = metrics.objection_counts ?? []
  const spend = roiRows.reduce((sum, row) => sum + Number(row.spend_minor ?? 0), 0)
  const attributedRevenue = roiRows.reduce((sum, row) => sum + Number(row.revenue_minor ?? 0), 0)

  return (
    <section className={['owner-report rounded-xl border border-border bg-surface-raised p-4 shadow-elev-2 sm:p-6', printPreview ? 'owner-report-print-preview' : ''].join(' ')} aria-labelledby="owner-report-title">
      <header className="owner-report-header flex flex-wrap items-start justify-between gap-5">
        <div className="flex items-start gap-3"><ProductMark size={42} /><div><p className="label-caps text-accent">Business report</p><h2 id="owner-report-title" className="mt-1 text-2xl font-semibold tracking-[-0.045em] text-fg">The business, at a glance.</h2><p className="mt-1 text-xs text-fg-muted">{period === 'week' ? 'Last 7 days' : 'Last 30 days'} · {metrics.window.from} to {metrics.window.to}</p></div></div>
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

      <div className="mt-6 space-y-4">
        <section className="owner-report-metrics grid overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-4" aria-label="Business summary metrics">
          <Metric icon={IndianRupee} label="Revenue closed" value={formatINRCompact(closed)} detail={target > 0 ? `${Math.round((closed / target) * 100)}% of ${formatINRCompact(target)} target this month` : 'No target set for this month'} />
          <Metric icon={Target} label="Open pipeline" value={formatINRCompact(pipelineValue)} detail={`${formatINRCompact(metrics.pipeline_weighted_total)} weighted by stage`} />
          <Metric icon={MessageSquareText} label="Conversations" value={String(conversations)} detail={onTimePct === null ? 'No follow-ups completed in this window' : `${onTimePct}% of follow-ups closed on time`} />
          <Metric icon={CalendarCheck} label="Deals won" value={String(wonCount)} detail={spend > 0 ? `${money(spend)} campaign spend, ${money(attributedRevenue)} attributed back` : 'No campaign spend recorded'} />
        </section>

        <section className="owner-report-charts grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <article className="overflow-hidden rounded-lg border border-border bg-surface">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border p-4"><div><p className="label-caps flex items-center gap-1.5"><TrendingUp aria-hidden size={13} /> Return on spend</p><h3 className="mt-1 text-md font-semibold text-fg">What each campaign brought back</h3></div><span className="tnum text-xs font-semibold text-fg-muted">{money(spend)} spent</span></div>
            {roiRows.length === 0
              ? <EmptyState icon={TrendingUp} title="No campaigns yet" body="Once a campaign exists and has spend against it, its return shows here." />
              : <RoiTable rows={roiRows} />}
          </article>
          <article className="rounded-lg border border-border bg-surface p-4">
            <div><p className="label-caps">Pipeline by stage</p><h3 className="mt-1 text-md font-semibold text-fg">{formatINRCompact(pipelineValue)} open</h3><p className="mt-1 text-2xs text-fg-muted">Current open value, unweighted.</p></div>
            {stages.length === 0 ? <p className="pt-4 text-xs text-fg-subtle">No open leads in any stage yet.</p> : <PipelineChart stages={stages} />}
          </article>
        </section>

        <section className="owner-report-tables grid gap-4 lg:grid-cols-[1fr_1.15fr]">
          <article className="overflow-hidden rounded-lg border border-border bg-surface">
            <div className="border-b border-border p-4"><p className="label-caps">Where revenue came from</p><h3 className="mt-1 text-md font-semibold text-fg">Won deals by source</h3></div>
            {wonBySource.length === 0
              ? <p className="p-4 text-xs text-fg-subtle">No deals were won in this window.</p>
              : <table className="w-full border-collapse text-xs"><thead><tr className="border-b border-border bg-surface-sunk text-fg-muted"><th scope="col" className="px-4 py-2 text-left font-semibold">Source</th><th scope="col" className="px-3 py-2 text-right font-semibold">Won</th><th scope="col" className="px-4 py-2 text-right font-semibold">Value</th></tr></thead><tbody>{wonBySource.map((row) => <tr key={`${row.source}-${row.campaign_id ?? ''}`} className="border-b border-border last:border-0"><th scope="row" className="px-4 py-3 text-left font-medium text-fg">{row.campaign_name ?? row.source}</th><td className="tnum px-3 py-3 text-right text-fg">{row.won_count}</td><td className="tnum px-4 py-3 text-right font-semibold text-fg">{formatINRCompact(row.amount)}</td></tr>)}</tbody></table>}
          </article>
          <article className="overflow-hidden rounded-lg border border-border bg-surface">
            <div className="border-b border-border p-4"><p className="label-caps">Top objections</p><h3 className="mt-1 text-md font-semibold text-fg">What buyers are pushing back on</h3></div>
            {objections.length === 0
              ? <p className="p-4 text-xs text-fg-subtle">No objections were logged in this window.</p>
              : <table className="w-full border-collapse text-xs"><thead><tr className="border-b border-border bg-surface-sunk text-fg-muted"><th scope="col" className="px-4 py-2 text-left font-semibold">Objection</th><th scope="col" className="px-4 py-2 text-right font-semibold">Times raised</th></tr></thead><tbody>{objections.map((row) => <tr key={row.taxonomy_key} className="border-b border-border last:border-0"><th scope="row" className="px-4 py-3 text-left font-medium text-fg">{row.label}</th><td className="tnum px-4 py-3 text-right font-semibold text-fg">{row.count}</td></tr>)}</tbody></table>}
          </article>
        </section>
      </div>

      <footer className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4 text-2xs text-fg-subtle"><span>Prepared {new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span><span>{metrics.window.days}-day window · no period-over-period comparison is available yet</span></footer>
    </section>
  )
}
