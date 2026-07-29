import { DASH } from '../../lib/mock-data'
import { inrCompact } from '../crm/PipelineStrip'
import { Panel, StatTile, Funnel, TrendLine, DayBars, ComplianceBar } from './charts'

// SA-04 Dashboard — manager/client_admin only (RepShell never mounts this; the
// rep's ten-seconds-after-a-message lane stays chart-free, §S6 RULING). The
// 2026-07-30 ruling lifts §1.10 items 1–2 for THIS screen; every other §1.10
// item still binds here.
//
// ENTIRELY SAMPLE DATA (lib/mock-data.ts — the one fake-data module). The
// wiring session computes the same shapes from leads / messages / follow_ups
// and replaces the DASH import; layout and chart components should not change.
//
// KPI choice is §S6 item 4's list verbatim: pipeline conversion, response
// time, volume by channel, rep leaderboard, follow-up compliance.

const capsStyle = {
  fontWeight: 'var(--weight-caps)',
  letterSpacing: 'var(--tracking-caps)',
} as const

const monoStyle = { fontFamily: 'var(--font-mono)' } as const

export function DashboardScreen() {
  const volumeMax = Math.max(...DASH.volume.map((d) => Math.max(d.whatsapp, d.instagram)), 1)
  const days = DASH.volume.map((d) => d.day)

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <p
        className="border-b border-border bg-surface-sunk px-4 py-1.5 text-2xs text-fg-subtle uppercase"
        style={capsStyle}
      >
        Sample data — dashboard wiring lands in a follow-up session
      </p>

      <div className="mx-auto max-w-5xl space-y-3 p-4">
        {/* Headline tiles — the four numbers a manager checks first. */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="Open conversations" value={String(DASH.headline.openConversations)} />
          <StatTile
            label="Needs human"
            value={String(DASH.headline.needsHuman)}
            tone={DASH.headline.needsHuman > 0 ? 'danger' : 'neutral'}
            sub="waiting for a person"
          />
          <StatTile label="Bookings this week" value={String(DASH.headline.bookingsWeek)} />
          <StatTile
            label="Open pipeline"
            value={`₹${inrCompact(DASH.headline.pipelineValue)}`}
            sub="est. value, open leads"
          />
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <Panel title="Pipeline conversion" caption="Leads reaching each stage, last 30 days.">
            <Funnel stages={DASH.funnel} />
          </Panel>

          <Panel
            title="First response time"
            caption="Median minutes to first human reply, last 14 days."
          >
            <TrendLine
              points={DASH.responseMins}
              unit="m"
              ariaLabel={`Median first response time, last 14 days, currently ${DASH.responseMins[DASH.responseMins.length - 1]} minutes`}
            />
          </Panel>

          <Panel
            title="Inbound volume by channel"
            caption="Messages per day, last 14 days. One row per channel."
          >
            <div className="space-y-3">
              {/* WA/IG — the app's channel badge vocabulary (QueueRow etc.). */}
              <DayBars label="WA" values={DASH.volume.map((d) => d.whatsapp)} days={days} max={volumeMax} />
              <DayBars label="IG" values={DASH.volume.map((d) => d.instagram)} days={days} max={volumeMax} />
            </div>
          </Panel>

          <Panel title="Follow-up compliance" caption="Pending + handled follow-ups, last 14 days.">
            <ComplianceBar
              done={DASH.followUps.done}
              dueToday={DASH.followUps.dueToday}
              overdue={DASH.followUps.overdue}
            />
          </Panel>
        </div>

        <Panel title="Rep leaderboard" caption="Replies sent, median reply time and leads won, last 14 days.">
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
                    style={capsStyle}
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
                        <span className="tnum w-10 text-right text-fg" style={monoStyle}>
                          {r.replies}
                        </span>
                      </div>
                    </td>
                    <td className="tnum py-2 text-right text-fg" style={monoStyle}>
                      {r.medianReplyMin}m
                    </td>
                    <td className="tnum py-2 text-right text-fg" style={monoStyle}>
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
