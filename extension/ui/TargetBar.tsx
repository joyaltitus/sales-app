import { formatINRCompact } from '../../src/ui/formatMoney'

type Props = {
  rep_name: string
  month_label: string
  target_value: number
  achieved_value: number
  incentive_per_won: number
  bonus_at_target: number
}

export function TargetBar({
  rep_name,
  month_label,
  target_value,
  achieved_value,
  incentive_per_won,
  bonus_at_target,
}: Props) {
  const pct = target_value > 0 ? Math.min(100, Math.round((achieved_value / target_value) * 100)) : 0
  const label = `${formatINRCompact(achieved_value)} of ${formatINRCompact(target_value)} — ${pct}% of ${month_label} target`
  return (
    <div
      className="flex min-h-10 items-center gap-3 border-b border-border bg-surface px-3 py-2"
      aria-label={`Target for ${rep_name}: ${label}. Incentive ${formatINRCompact(incentive_per_won)} per win, ${formatINRCompact(bonus_at_target)} bonus at target.`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className="text-sm font-semibold text-fg tnum">{formatINRCompact(achieved_value)}</span>
          <span className="text-2xs text-fg-subtle tnum">of {formatINRCompact(target_value)}</span>
          <span className="ml-auto text-2xs font-semibold text-accent tnum">{pct}%</span>
        </div>
        <div
          className="mt-1 h-1 overflow-hidden rounded-pill bg-surface-sunk"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={label}
        >
          <div className="h-full rounded-pill bg-accent" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-2xs font-semibold text-fg-muted tnum">₹{incentive_per_won.toLocaleString('en-IN')}/win</div>
        <div className="text-2xs text-fg-subtle tnum">+{formatINRCompact(bonus_at_target)} at target</div>
      </div>
    </div>
  )
}
