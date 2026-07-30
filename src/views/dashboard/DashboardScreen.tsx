import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useClient } from '../../shell/ClientProvider'
import { useQueue } from '../../lib/inbox-data'
import { useLeads, useLeadStages, useFollowUps } from '../../lib/leads-data'
import { useBookings } from '../../lib/crm-data'
import { DASH } from '../../lib/mock-data'
import { inrCompact } from '../crm/PipelineStrip'
import { Panel, StatTile, Funnel, TrendLine, DayBars, ComplianceBar } from './charts'
import { Skeleton } from '../../ui/Skeleton'

// SA-05 company dashboard — manager/client_admin. REAL wherever the browser
// already holds the data under RLS (conversations, leads, stages, follow_ups,
// bookings — the same bounded reads the other screens issue); SAMPLE-tagged
// where the honest number needs server-side aggregation that doesn't exist
// yet (response time, per-day volume, rep leaderboard — messages carry no
// cheap channel/day rollup and no rep attribution browser-side).

const D = 24 * 3_600_000

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

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-3 p-4">
        {/* Headline tiles — REAL, from the same reads the working screens use. */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="Open conversations" value={String(real.open)} />
          <StatTile
            label="Needs human"
            value={String(real.needsHuman)}
            tone={real.needsHuman > 0 ? 'danger' : 'neutral'}
            sub="waiting for a person"
          />
          <StatTile label="Bookings (7 days)" value={String(real.bookingsWeek)} />
          <StatTile
            label="Open pipeline"
            value={`₹${inrCompact(real.pipelineValue)}`}
            sub={
              real.winRate == null
                ? 'est. value, open leads'
                : `win rate ${real.winRate}% (${real.won}W ${real.lost}L)`
            }
          />
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

        <Panel
          title="Rep leaderboard"
          sample
          caption="Per-rep attribution isn't recorded browser-side yet — numbers are sample until the wiring session."
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
                    <td className="py-2 text-fg">{r.name}</td>
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
      </div>
    </div>
  )
}
