import { lazy, Suspense, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useClient } from '../../shell/ClientProvider'
import { useQueue } from '../../lib/inbox-data'
import { useLeads, useLeadStages, useFollowUps } from '../../lib/leads-data'
import { useBookings } from '../../lib/crm-data'
import { DASH } from '../../lib/mock-data'
import { inrCompact } from '../crm/PipelineStrip'
import { Panel, StatTile, HeroStat, Funnel, TrendLine, DayBars, ComplianceBar } from './charts'
import { Skeleton } from '../../ui/Skeleton'
import { ArrowDownRight, ArrowUpRight, Clock3, MessageSquareText, Target, Trophy } from 'lucide-react'
import { ObjectionsReview } from './ObjectionsReview'
import { ForecastWidget } from '../revenue/ForecastWidget'

const CompetitionConsole = lazy(() => import('../momentum/CompetitionConsole'))
const OwnerBusinessReport = lazy(() => import('../reports/OwnerBusinessReport'))

// SA-05 company dashboard — manager/client_admin. REAL wherever the browser
// already holds the data under RLS (conversations, leads, stages, follow_ups,
// bookings — the same bounded reads the other screens issue); SAMPLE-tagged
// where the honest number needs server-side aggregation that doesn't exist
// yet (response time, per-day volume, rep leaderboard — messages carry no
// cheap channel/day rollup and no rep attribution browser-side).

const D = 24 * 3_600_000

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
  delta: string
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
        <span className={['flex items-center gap-0.5 text-2xs font-semibold', good ? 'text-success' : 'text-danger'].join(' ')}><Delta aria-hidden size={12} />{delta}</span>
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

  const volumeMax = Math.max(...DASH.volume.map((d) => Math.max(d.whatsapp, d.instagram)), 1)
  const days = DASH.volume.map((d) => d.day)
  const totalVolume = DASH.volume.reduce((sum, day) => sum + day.whatsapp + day.instagram, 0)
  const bestRep = [...DASH.reps].sort((a, b) => b.won - a.won)[0]

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="page-frame max-w-6xl space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="label-caps text-accent">Team intelligence</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-fg">See the signal, skip the spreadsheet.</h1>
            <p className="mt-1 text-sm text-fg-muted">Live operating data and clearly marked preview analytics.</p>
          </div>
          <div className="flex rounded-md border border-border bg-surface-sunk p-0.5" role="group" aria-label="Dashboard period preview">
            {['7 days', '30 days', 'Quarter'].map((period, index) => (
              <button key={period} className={['rounded-sm px-3 py-1.5 text-xs font-semibold', index === 1 ? 'bg-surface-raised text-fg shadow-elev-1' : 'text-fg-muted hover:text-fg'].join(' ')} aria-pressed={index === 1} title="Period selector preview — not wired">{period}</button>
            ))}
          </div>
        </header>

        <Suspense fallback={<Skeleton className="h-[820px]" />}>
          <OwnerBusinessReport />
        </Suspense>

        <section aria-labelledby="analytics-snapshot">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="analytics-snapshot" className="text-md font-semibold text-fg">Operating snapshot</h2>
            <span className="label-caps rounded-pill border border-dashed border-border-strong px-2 py-1">Preview rollups</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <AnalyticsKpi icon={Clock3} label="First response" value={`${DASH.responseMins.at(-1)}m`} delta="3m faster" values={DASH.responseMins} />
            <AnalyticsKpi icon={MessageSquareText} label="Inbound volume" value={String(totalVolume)} delta="12% vs prior" values={DASH.volume.map((day) => day.whatsapp + day.instagram)} />
            <AnalyticsKpi icon={Target} label="Follow-up compliance" value={`${Math.round((DASH.followUps.done / (DASH.followUps.done + DASH.followUps.dueToday + DASH.followUps.overdue)) * 100)}%`} delta="6 pts" values={[68, 74, 72, 79, 83, 86, 88]} />
            <AnalyticsKpi icon={Trophy} label="Personal-best pace" value={bestRep?.name ?? '—'} delta={`${bestRep?.won ?? 0} wins`} values={DASH.reps.map((rep) => rep.won)} />
          </div>
        </section>

        {/* The one number first (UI-DESIGN-01, audit A5): pipeline value leads
            as a hero band; the rest are REAL tiles that defer to it. */}
        <HeroStat
          label="Open pipeline"
          value={`₹${inrCompact(real.pipelineValue)}`}
          sub={
            real.winRate == null
              ? 'Estimated value across open leads'
              : `Win rate ${real.winRate}% — ${real.won} won, ${real.lost} lost`
          }
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatTile label="Open conversations" value={String(real.open)} />
          <StatTile
            label="Needs human"
            value={String(real.needsHuman)}
            tone={real.needsHuman > 0 ? 'danger' : 'neutral'}
            sub="waiting for a person"
          />
          <StatTile label="Bookings (7 days)" value={String(real.bookingsWeek)} />
        </div>

        {/* Follow-up pressure — REAL; links straight to the work. */}
        {(real.overdue > 0 || real.dueToday > 0) && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-border bg-surface px-4 py-2.5 text-xs">
            {real.overdue > 0 && (
              <Link to="/crm?tab=followups" className="font-medium text-danger hover:underline">
                {real.overdue} follow-up{real.overdue === 1 ? '' : 's'} overdue
              </Link>
            )}
            {real.dueToday > 0 && (
              <Link to="/crm?tab=followups" className="text-fg-muted hover:text-fg hover:underline">
                {real.dueToday} due today
              </Link>
            )}
            {real.needsHuman > 0 && (
              <Link to="/inbox" className="text-fg-muted hover:text-fg hover:underline">
                {real.needsHuman} thread{real.needsHuman === 1 ? '' : 's'} need a human
              </Link>
            )}
          </div>
        )}

        <div className="grid gap-3 lg:grid-cols-2">
          <Panel title="Pipeline by stage" caption="Live count of leads sitting in each stage.">
            <Funnel stages={real.funnel} />
          </Panel>

          <Panel
            title="First response time"
            sample
            caption="Median minutes to first human reply — needs server-side aggregation, wiring session pending."
          >
            <TrendLine
              points={DASH.responseMins}
              unit="m"
              ariaLabel="Sample response time trend"
            />
          </Panel>

          <Panel
            title="Inbound volume by channel"
            sample
            caption="Messages per day — needs a server-side rollup, wiring session pending."
          >
            <div className="space-y-3">
              <DayBars label="WA" values={DASH.volume.map((d) => d.whatsapp)} days={days} max={volumeMax} />
              <DayBars label="IG" values={DASH.volume.map((d) => d.instagram)} days={days} max={volumeMax} />
            </div>
          </Panel>

          <Panel
            title="Follow-up compliance"
            sample
            caption="Handled-on-time rate needs completed-follow-up history; the overdue and due-today counts above are live."
          >
            <ComplianceBar
              done={DASH.followUps.done}
              dueToday={real.dueToday}
              overdue={real.overdue}
            />
          </Panel>
        </div>

        <ForecastWidget />

        <div className="border-t border-border pt-6"><Suspense fallback={<Skeleton className="h-[520px]" />}><CompetitionConsole /></Suspense></div>

        <Panel
          title="Personal bests"
          sample
          caption="Framed around each rep's pace and improvement. Per-rep attribution is sample until the wiring session."
        >
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border">
                {['Rep', 'Replies', 'Median reply', 'Won'].map((h, i) => (
                  <th
                    key={h}
                    scope="col"
                    className={[
                      'py-1.5 text-2xs text-fg-subtle uppercase',
                      i === 0 ? 'text-left' : 'text-right',
                    ].join(' ')}
                    style={{ fontWeight: 'var(--weight-caps)', letterSpacing: 'var(--tracking-caps)' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DASH.reps.map((r) => {
                const maxReplies = Math.max(...DASH.reps.map((x) => x.replies), 1)
                return (
                  <tr key={r.name} className="border-b border-border last:border-0">
                    <td className="py-3 text-fg">
                      <span className="font-medium">{r.name}</span>
                      {r.name === bestRep?.name && <span className="ml-2 rounded-pill bg-accent-subtle px-2 py-0.5 text-2xs font-semibold text-accent">best pace</span>}
                    </td>
                    <td className="py-2">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-2 w-24 overflow-hidden rounded-pill bg-surface-sunk">
                          <div
                            className="h-full rounded-pill bg-fg-subtle"
                            style={{ width: `${(r.replies / maxReplies) * 100}%` }}
                          />
                        </div>
                        <span
                          className="tnum w-10 text-right text-fg"
                          style={{ fontFamily: 'var(--font-mono)' }}
                        >
                          {r.replies}
                        </span>
                      </div>
                    </td>
                    <td className="tnum py-2 text-right text-fg" style={{ fontFamily: 'var(--font-mono)' }}>
                      {r.medianReplyMin}m
                    </td>
                    <td className="tnum py-2 text-right text-fg" style={{ fontFamily: 'var(--font-mono)' }}>
                      {r.won}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Panel>

        <div className="border-t border-border pt-6">
          <ObjectionsReview />
        </div>
      </div>
    </div>
  )
}
