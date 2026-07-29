// SA-04 hand-rolled SVG charts — no chart library (bundle budget + §1.10 #17
// spirit). Frozen-palette constraint, validated with the dataviz skill's
// palette validator: the token set has NO second categorical hue that passes
// the normal-vision/CVD checks against the teal on the light surface, so NO
// chart in this app encodes identity by color. Every chart is single-hue
// (neutral ink); multi-series questions become small multiples; status colors
// appear only where they mean status, always beside a text label. Identity
// lives in titles and direct labels — never in a color legend.
//
// Marks follow the skill's specs: 2px lines, thin bars with 2px surface gaps,
// recessive axes, selective direct labels, native <title> per-mark tooltips.

const capsStyle = {
  fontWeight: 'var(--weight-caps)',
  letterSpacing: 'var(--tracking-caps)',
} as const

const monoStyle = { fontFamily: 'var(--font-mono)' } as const

export function Panel({
  title,
  children,
  caption,
}: {
  title: string
  children: React.ReactNode
  caption?: string
}) {
  return (
    <section className="rounded-md border border-border bg-surface p-4">
      <h2 className="text-2xs text-fg-subtle uppercase" style={capsStyle}>
        {title}
      </h2>
      <div className="mt-3">{children}</div>
      {caption && <p className="mt-2 text-2xs text-fg-subtle">{caption}</p>}
    </section>
  )
}

export function StatTile({
  label,
  value,
  sub,
  tone = 'neutral',
}: {
  label: string
  value: string
  sub?: string
  tone?: 'neutral' | 'danger'
}) {
  return (
    <div className="rounded-md border border-border bg-surface px-4 py-3">
      <div className="text-2xs text-fg-subtle uppercase" style={capsStyle}>
        {label}
      </div>
      <div
        className={['tnum mt-1 text-xl leading-none', tone === 'danger' ? 'text-danger' : 'text-fg'].join(' ')}
        style={{
          ...monoStyle,
          fontWeight: 'var(--weight-num)',
          letterSpacing: 'var(--tracking-tight)',
        }}
      >
        {value}
      </div>
      {sub && <div className="mt-1 text-2xs text-fg-subtle">{sub}</div>}
    </div>
  )
}

/** Horizontal funnel — magnitude, one hue. Direct labels carry the numbers;
 *  the step-to-step conversion is the line a manager actually asks for. */
export function Funnel({ stages }: { stages: { label: string; count: number }[] }) {
  const max = Math.max(...stages.map((s) => s.count), 1)
  return (
    <div className="space-y-2" role="img" aria-label={funnelAria(stages)}>
      {stages.map((s, i) => {
        const pct = i === 0 ? null : Math.round((s.count / stages[i - 1].count) * 100)
        return (
          <div key={s.label} className="flex items-center gap-3">
            <span className="w-16 shrink-0 truncate text-xs text-fg-muted">{s.label}</span>
            <div className="h-4 min-w-0 flex-1">
              <div
                className="h-full rounded-[4px] bg-fg-subtle"
                style={{ width: `${(s.count / max) * 100}%`, minWidth: 2 }}
                title={`${s.label}: ${s.count}`}
              />
            </div>
            <span className="tnum w-8 shrink-0 text-right text-xs text-fg" style={monoStyle}>
              {s.count}
            </span>
            <span className="tnum w-10 shrink-0 text-right text-2xs text-fg-subtle" style={monoStyle}>
              {pct == null ? '' : `${pct}%`}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function funnelAria(stages: { label: string; count: number }[]): string {
  return 'Pipeline conversion: ' + stages.map((s) => `${s.label} ${s.count}`).join(', ')
}

/** Line chart — one series, 2px ink line, recessive grid, last point labeled. */
export function TrendLine({
  points,
  unit,
  ariaLabel,
}: {
  points: number[]
  unit: string
  ariaLabel: string
}) {
  const W = 280
  const H = 72
  const PAD = 4
  const max = Math.max(...points, 1)
  const x = (i: number) => PAD + (i / (points.length - 1)) * (W - PAD * 2)
  const y = (v: number) => H - PAD - (v / max) * (H - PAD * 2)
  const d = points.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const last = points[points.length - 1]
  return (
    <div className="flex items-end gap-3">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-[72px] min-w-0 flex-1"
        role="img"
        aria-label={ariaLabel}
        preserveAspectRatio="none"
      >
        {/* recessive midline, not a full grid */}
        <line x1={PAD} x2={W - PAD} y1={y(max / 2)} y2={y(max / 2)} stroke="var(--border)" strokeWidth="1" />
        <path d={d} fill="none" stroke="var(--fg)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((v, i) => (
          <circle key={i} cx={x(i)} cy={y(v)} r="6" fill="transparent">
            <title>{`Day ${i + 1}: ${v}${unit}`}</title>
          </circle>
        ))}
        <circle cx={x(points.length - 1)} cy={y(last)} r="2.5" fill="var(--fg)" />
      </svg>
      <div className="shrink-0 text-right">
        <div
          className="tnum text-lg leading-none text-fg"
          style={{ ...monoStyle, fontWeight: 'var(--weight-num)', letterSpacing: 'var(--tracking-tight)' }}
        >
          {last}
          {unit}
        </div>
        <div className="mt-0.5 text-2xs text-fg-subtle">today</div>
      </div>
    </div>
  )
}

/** One small-multiple row of daily bars — single hue, 2px gaps, per-bar
 *  tooltip. Used per channel; NEVER stacked into one two-color chart (the
 *  frozen palette cannot carry two categorical hues — see file header). */
export function DayBars({
  label,
  values,
  days,
  max,
}: {
  label: string
  values: number[]
  days: string[]
  max: number
}) {
  const total = values.reduce((a, b) => a + b, 0)
  return (
    <div className="flex items-center gap-3">
      <span className="w-7 shrink-0 text-2xs text-fg-subtle uppercase" style={capsStyle}>
        {label}
      </span>
      <div className="flex h-10 min-w-0 flex-1 items-end gap-[2px]" role="img" aria-label={`${label}: ${total} messages over ${values.length} days`}>
        {values.map((v, i) => (
          <div
            key={i}
            className="min-w-0 flex-1 rounded-t-[3px] bg-fg-subtle"
            style={{ height: `${Math.max((v / max) * 100, 3)}%` }}
            title={`${days[i]}: ${v}`}
          />
        ))}
      </div>
      <span className="tnum w-10 shrink-0 text-right text-xs text-fg" style={monoStyle}>
        {total}
      </span>
    </div>
  )
}

/** Follow-up compliance — status job, so status colors are legal here; each
 *  segment is also labeled with text+count (never color alone). */
export function ComplianceBar({ done, dueToday, overdue }: { done: number; dueToday: number; overdue: number }) {
  const total = Math.max(done + dueToday + overdue, 1)
  const pct = Math.round((done / total) * 100)
  const seg = (v: number) => `${(v / total) * 100}%`
  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span
          className="tnum text-xl leading-none text-fg"
          style={{ ...monoStyle, fontWeight: 'var(--weight-num)', letterSpacing: 'var(--tracking-tight)' }}
        >
          {pct}%
        </span>
        <span className="text-2xs text-fg-subtle">of follow-ups handled on time</span>
      </div>
      <div className="mt-2 flex h-2 gap-[2px] overflow-hidden rounded-pill" role="img" aria-label={`Follow-ups: ${done} done, ${dueToday} due today, ${overdue} overdue`}>
        <div className="bg-success" style={{ width: seg(done) }} title={`Done: ${done}`} />
        <div className="bg-warn" style={{ width: seg(dueToday) }} title={`Due today: ${dueToday}`} />
        <div className="bg-danger" style={{ width: seg(overdue) }} title={`Overdue: ${overdue}`} />
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {(
          [
            ['Done', done, 'text-success'],
            ['Due today', dueToday, 'text-warn'],
            ['Overdue', overdue, 'text-danger'],
          ] as const
        ).map(([label, v, cls]) => (
          <span key={label} className="flex items-center gap-1.5 text-2xs text-fg-muted">
            <span aria-hidden className={['inline-block h-2 w-2 rounded-pill', cls.replace('text-', 'bg-')].join(' ')} />
            {label}
            <span className="tnum text-fg" style={monoStyle}>
              {v}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}
