import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useClient } from '../../shell/ClientProvider'
import { useQueue } from '../../lib/inbox-data'
import { useLeads, useLeadStages, useFollowUps } from '../../lib/leads-data'
import { useBookings } from '../../lib/crm-data'
import { downloadCsv } from '../../lib/crm-data'
import { useMetrics } from '../../lib/metrics-data'
import { formatINRCompact } from '../../ui/formatMoney'
import { Panel, StatTile, HeroStat, Funnel, TrendLine, DayBars, ComplianceBar } from './charts'
import { Skeleton } from '../../ui/Skeleton'
import { Activity, ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, BriefcaseBusiness, Clock3, Download, FileText, MessageSquareText, Target } from 'lucide-react'
import { ForecastWidget } from '../revenue/ForecastWidget'
import { EmptyState } from '../../ui/EmptyState'

// SA-05 company dashboard — manager/client_admin. REAL wherever the browser
// already holds the data under RLS (conversations, leads, stages, follow_ups,
// bookings, won-per-rep via useTeamWinsThisMonth — the same bounded reads the
// other screens issue); SAMPLE-tagged where the honest number needs
// server-side aggregation that doesn't exist yet (response time, per-day
// volume, reply count/median-reply-time per rep — messages carry no cheap
// channel/day rollup and no rep attribution browser-side).

const D = 24 * 3_600_000
type DashboardView = 'operate' | 'revenue' | 'report'
const DASHBOARD_VIEWS: { key: DashboardView; label: string; icon: typeof Activity }[] = [
  { key: 'operate', label: 'Operate', icon: Activity },
  { key: 'revenue', label: 'Revenue', icon: BarChart3 },
  { key: 'report', label: 'Business report', icon: FileText },
]

function MiniSpark({ values }: { values: number[] }) {
  const max = Math.max(...values, 1)
  const min = Math.min(...values)
  const span = Math.max(1, max - min)
  const points = values.map((value, index) => `${(index / Math.max(1, values.length - 1)) * 100},${28 - ((value - min) / span) * 22}`).join(' ')
  return (
    <svg viewBox="0 0 100 32" className="h-8 w-24" aria-hidden preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

function AnalyticsKpi({
  icon: Icon,
  label,
  value,
  delta,
  good = true,
  values,
}: {
  icon: typeof Clock3
  label: string
  value: string
  /** Period-over-period comparison text. Omitted (not fabricated) when no prior-window
   *  comparator exists yet — H.5's period comparators land with the owner-report follow-on. */
  delta?: string
  good?: boolean
  values: number[]
}) {
  const Delta = good ? ArrowUpRight : ArrowDownRight
  return (
    <article className="rounded-lg border border-border bg-surface p-4 shadow-elev-1">
      <div className="flex items-center justify-between gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-accent-subtle text-accent"><Icon aria-hidden size={17} /></span>
        <MiniSpark values={values} />
      </div>
      <p className="label-caps mt-4">{label}</p>
      <div className="mt-1.5 flex items-end justify-between gap-2">
        <strong className="tnum text-2xl leading-none tracking-[-0.04em] text-fg">{value}</strong>
        {delta && <span className={['flex items-center gap-0.5 text-2xs font-semibold', good ? 'text-success' : 'text-danger'].join(' ')}><Delta aria-hidden size={12} />{delta}</span>}
      </div>
    </article>
  )
}

export function DashboardScreen() {
  const { activeClient } = useClient()
  const clientId = activeClient?.id ?? null

  const { items: convs, loading: convsLoading } = useQueue(clientId)
  const { items: leads, loading: leadsLoading } = useLeads(clientId)
  const { stages } = useLeadStages(clientId)
  const { items: followUps } = useFollowUps(clientId)
  const { items: bookings } = useBookings(clientId)
  // WIRE-B2/S10: one snapshot from GET /api/metrics, no polling — response-time
  // series, volume by channel, per-rep replies/median/won, follow-up compliance.
  const { data: metrics, loading: metricsLoading } = useMetrics('14d', clientId)
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedView = searchParams.get('view')
  const view: DashboardView = DASHBOARD_VIEWS.some((item) => item.key === requestedView) ? requestedView as DashboardView : 'operate'

  const setView = (next: DashboardView) => {
    const params = new URLSearchParams(searchParams)
    if (next === 'operate') params.delete('view')
    else params.set('view', next)
    setSearchParams(params, { replace: true })
  }

  const now = Date.now()

  const real = useMemo(() => {
    const open = convs.filter((c) => c.status === 'open').length
    const needsHuman = convs.filter((c) => c.bot_paused && !c.escalation_resolved).length

    const funnel = stages.map((s) => ({
      label: s.label,
      count: leads.filter((l) => l.stage_id === s.id).length,
    }))
    const pipelineValue = leads
      .filter((l) => l.status === 'open')
      .reduce((a, l) => a + Number(l.est_value ?? 0), 0)
    const won = leads.filter((l) => l.status === 'won').length
    const lost = leads.filter((l) => l.status === 'lost').length
    const winRate = won + lost > 0 ? Math.round((won / (won + lost)) * 100) : null

    const end = new Date(now)
    end.setHours(23, 59, 59, 999)
    const overdue = followUps.filter((f) => new Date(f.due_at).getTime() < now).length
    const dueToday = followUps.filter((f) => {
      const t = new Date(f.due_at).getTime()
      return t >= now && t <= end.getTime()
    }).length

    const bookingsWeek = bookings.filter(
      (b) => now - new Date(b.created_at).getTime() <= 7 * D,
    ).length

    return { open, needsHuman, funnel, pipelineValue, winRate, won, lost, overdue, dueToday, bookingsWeek }
  }, [convs, leads, stages, followUps, bookings, now])

  if (convsLoading || leadsLoading) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  // WIRE-B2/S10: response-time, volume-by-channel and per-rep replies/median/won
  // are now real, all from the one metrics snapshot — DASH is gone from this file.
  const responseSeries = metrics?.response_time_series ?? []
  const responseMinsPoints = responseSeries
    .filter((p) => p.median_minutes != null)
    .map((p) => Math.round(p.median_minutes as number))

  const volumeSeries = metrics?.volume_by_channel ?? []
  const volumeMax = Math.max(...volumeSeries.map((d) => Math.max(d.whatsapp, d.instagram)), 1)
  const days = volumeSeries.map((d) => d.date.slice(5))
  const totalVolume = volumeSeries.reduce((sum, day) => sum + day.whatsapp + day.instagram, 0)

  const followUpCompliance = metrics?.follow_up_compliance ?? null
  const followUpDoneTotal = followUpCompliance
    ? followUpCompliance.done_on_time + followUpCompliance.done_late
    : 0

  const isManagerOrAdmin = activeClient?.role !== 'agent'

  const exportDashboardCsv = () => {
    downloadCsv(
      `dashboard-metrics-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Date', 'Median first-response (min)', 'WhatsApp inbound', 'Instagram inbound'],
      volumeSeries.map((day) => {
        const point = responseSeries.find((p) => p.date === day.date)
        return [day.date, point?.median_minutes ?? '', day.whatsapp, day.instagram]
      }),
    )
  }

  const viewCopy: Record<DashboardView, { eyebrow: string; title: string; detail: string }> = {
    operate: { eyebrow: 'Today', title: 'Run the floor without chasing updates.', detail: 'Live exceptions first; healthy work stays quiet.' },
    revenue: { eyebrow: 'Revenue', title: 'Know what can close and where it is stuck.', detail: 'Live pipeline with a clearly labelled preview forecast.' },
    report: { eyebrow: 'Owner view', title: 'The business, ready to forward.', detail: 'A clean weekly or monthly summary for leadership.' },
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="page-frame max-w-6xl space-y-6">
        <header>
          <p className="label-caps text-accent">{viewCopy[view].eyebrow}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-fg">{viewCopy[view].title}</h1>
          <p className="mt-1 text-sm text-fg-muted">{viewCopy[view].detail}</p>
        </header>

        <nav className="no-scrollbar flex gap-1 overflow-x-auto rounded-xl border border-border bg-surface-sunk p-1" aria-label="Dashboard views">
          {DASHBOARD_VIEWS.map((item) => <button key={item.key} onClick={() => setView(item.key)} aria-current={view === item.key ? 'page' : undefined} className={['flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg px-3 text-xs font-semibold sm:flex-1', view === item.key ? 'bg-surface-raised text-fg shadow-elev-1' : 'text-fg-muted hover:text-fg'].join(' ')}><item.icon aria-hidden size={15} />{item.label}</button>)}
        </nav>

        {view === 'operate' && <section className="space-y-6" aria-labelledby="manager-today">
          <article className="overflow-hidden rounded-xl border border-border bg-surface shadow-elev-2">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface-raised px-4 py-4 sm:px-5">
              <div><p className="label-caps text-accent">Live priorities</p><h2 id="manager-today" className="mt-1 text-lg font-semibold tracking-[-0.025em] text-fg">What needs attention today</h2></div>
              <Link to="/" className="inline-flex min-h-11 items-center gap-1 rounded-md px-3 text-xs font-semibold text-accent hover:bg-accent-subtle">Open live floor <ArrowRight aria-hidden size={14} /></Link>
            </header>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: 'Overdue follow-ups', value: real.overdue, detail: 'Promises already missed', to: '/crm?tab=followups', icon: Clock3, danger: real.overdue > 0 },
                { label: 'Needs a human', value: real.needsHuman, detail: 'Bot handovers unclaimed', to: '/inbox', icon: MessageSquareText, danger: real.needsHuman > 0 },
                { label: 'Due later today', value: real.dueToday, detail: 'Planned customer follow-ups', to: '/crm?tab=followups', icon: Target, danger: false },
                { label: 'Bookings this week', value: real.bookingsWeek, detail: 'Visits and meetings created', to: '/crm?tab=bookings', icon: BriefcaseBusiness, danger: false },
              ].map((item) => <Link key={item.label} to={item.to} className="group flex min-h-36 flex-col border-b border-border p-4 last:border-b-0 hover:bg-surface-sunk sm:border-r sm:[&:nth-child(2)]:border-r-0 lg:border-b-0 lg:[&:nth-child(2)]:border-r lg:last:border-r-0"><span className={['flex h-9 w-9 items-center justify-center rounded-md', item.danger ? 'bg-danger-subtle text-danger' : 'bg-surface-sunk text-fg-muted'].join(' ')}><item.icon aria-hidden size={16} /></span><strong className={['tnum mt-4 text-2xl tracking-[-0.04em]', item.danger ? 'text-danger' : 'text-fg'].join(' ')}>{item.value}</strong><span className="mt-1 text-xs font-semibold text-fg">{item.label}</span><span className="mt-1 text-2xs text-fg-muted">{item.detail}</span></Link>)}
            </div>
          </article>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatTile label="Open conversations" value={String(real.open)} />
            <StatTile label="Needs human" value={String(real.needsHuman)} tone={real.needsHuman > 0 ? 'danger' : 'neutral'} sub="waiting for a person" />
            <StatTile label="Bookings (7 days)" value={String(real.bookingsWeek)} />
          </div>

          <section aria-labelledby="analytics-snapshot">
            <div className="mb-3 flex items-center justify-between"><h2 id="analytics-snapshot" className="text-md font-semibold text-fg">Operating trend</h2><button onClick={exportDashboardCsv} className="flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 text-2xs font-medium text-fg-muted hover:border-border-strong hover:text-fg"><Download aria-hidden size={12} strokeWidth={1.75} />Export CSV</button></div>
            <div className="grid gap-3 sm:grid-cols-3"><AnalyticsKpi icon={Clock3} label="First response" value={responseMinsPoints.length ? `${responseMinsPoints.at(-1)}m` : '—'} values={responseMinsPoints} /><AnalyticsKpi icon={MessageSquareText} label="Inbound volume" value={String(totalVolume)} values={volumeSeries.map((day) => day.whatsapp + day.instagram)} /><AnalyticsKpi icon={Target} label="Follow-up compliance" value={followUpCompliance ? `${Math.round((followUpDoneTotal / Math.max(followUpDoneTotal + real.dueToday + real.overdue, 1)) * 100)}%` : '—'} values={[followUpDoneTotal]} /></div>
          </section>

          <div className="grid gap-3 lg:grid-cols-2">
            <Panel title="First response time" caption="Median minutes inbound → first human/bot reply, per day (14d window).">{metricsLoading ? <Skeleton className="h-[72px]" /> : responseMinsPoints.length ? <TrendLine points={responseMinsPoints} unit="m" ariaLabel="Response time trend" /> : <p className="text-xs text-fg-subtle">No inbound messages in this window yet.</p>}</Panel>
            <Panel title="Inbound volume by channel" caption="Messages per day, last 14 days.">{metricsLoading ? <Skeleton className="h-20" /> : <div className="space-y-3"><DayBars label="WA" values={volumeSeries.map((d) => d.whatsapp)} days={days} max={volumeMax} /><DayBars label="IG" values={volumeSeries.map((d) => d.instagram)} days={days} max={volumeMax} /></div>}</Panel>
            <Panel title="Follow-up compliance" caption="Overdue and due-today counts are live; completion history is a 14d window.">{metricsLoading ? <Skeleton className="h-16" /> : <ComplianceBar done={followUpDoneTotal} dueToday={real.dueToday} overdue={real.overdue} />}</Panel>
          </div>
        </section>}

        {view === 'revenue' && <section className="space-y-6" aria-label="Revenue dashboard">
          <HeroStat label="Open pipeline" value={formatINRCompact(real.pipelineValue)} sub={real.winRate == null ? 'Estimated value across open leads' : `Win rate ${real.winRate}% — ${real.won} won, ${real.lost} lost`} />
          <div className="grid grid-cols-3 gap-3"><StatTile label="Won" value={String(real.won)} /><StatTile label="Lost" value={String(real.lost)} /><StatTile label="Win rate" value={real.winRate == null ? '—' : `${real.winRate}%`} /></div>
          <Panel title="Pipeline by stage" caption="Live count of leads sitting in each stage."><Funnel stages={real.funnel} /></Panel>
          <ForecastWidget metrics={metrics} loading={metricsLoading} />
          {isManagerOrAdmin && metrics?.objection_counts && metrics.objection_counts.length > 0 && (
            <Panel title="Objections by type" caption="Logged objections in the last 14 days, most common first.">
              <Funnel stages={metrics.objection_counts.map((o) => ({ label: o.label, count: o.count }))} />
            </Panel>
          )}
          {isManagerOrAdmin && metrics?.won_by_source && metrics.won_by_source.length > 0 && (
            <Panel title="Won by source" caption="Won leads in the last 14 days, by source.">
              <div className="space-y-2">
                {(() => {
                  const maxAmount = Math.max(...metrics.won_by_source.map((s) => s.amount), 1)
                  return metrics.won_by_source.map((s) => (
                    <div key={`${s.source}-${s.campaign_id ?? ''}`} className="flex items-center gap-3">
                      <span className="w-24 shrink-0 truncate text-xs text-fg-muted">{s.campaign_name ?? s.source}</span>
                      <div className="h-4 min-w-0 flex-1">
                        <div
                          className="h-full rounded-[4px] bg-chart-ink"
                          style={{ width: `${(s.amount / maxAmount) * 100}%`, minWidth: 2 }}
                          title={`${s.source}: ${formatINRCompact(s.amount)}, ${s.won_count} won`}
                        />
                      </div>
                      <span className="tnum w-16 shrink-0 text-right text-xs text-fg">{formatINRCompact(s.amount)}</span>
                    </div>
                  ))
                })()}
              </div>
            </Panel>
          )}
        </section>}

        {view === 'report' && (
          <div className="p-6">
            <EmptyState title="Owner report arrives with campaign ROI" body="A clean weekly or monthly summary for leadership is on the way." />
          </div>
        )}
      </div>
    </div>
  )
}
