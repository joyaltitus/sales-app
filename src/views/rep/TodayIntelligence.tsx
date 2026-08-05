import { ArrowRight, ChevronDown, Flame, IndianRupee, Snowflake, Sparkles, Target, Trophy } from 'lucide-react'
import { Link } from 'react-router-dom'
import { MomentumCard } from '../momentum/RepMomentum'
import { formatINR, formatINRCompact } from '../../ui/formatMoney'

export type DailyDigestPreview = {
  hotLeads: number
  goingCold: number
  yesterday: { calls: number; replies: number; closedValue: number }
  sample: true
}

export type RepRevenuePreview = {
  month: string
  closed: number
  target: number
  openPipeline: number
  requiredCoverage: number
  sample: true
}

const DIGEST: DailyDigestPreview = { hotLeads: 3, goingCold: 2, yesterday: { calls: 11, replies: 28, closedValue: 85000 }, sample: true }
const REVENUE: RepRevenuePreview = { month: 'August', closed: 240000, target: 500000, openPipeline: 910000, requiredCoverage: 1100000, sample: true }

export default function TodayIntelligence() {
  const progress = Math.round((REVENUE.closed / REVENUE.target) * 100)
  const gap = Math.max(0, REVENUE.requiredCoverage - REVENUE.openPipeline)
  return <div className="mt-4 space-y-3">
    <section className="rounded-xl border border-border bg-surface p-4 shadow-elev-1"><div className="flex items-start justify-between gap-4"><div><p className="label-caps">Your {REVENUE.month} · Preview</p><h2 className="mt-1 text-md font-semibold text-fg">{formatINR(REVENUE.closed)} closed</h2><p className="mt-1 text-xs text-fg-muted">{progress}% of {formatINR(REVENUE.target)} target</p></div><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-success-subtle text-success"><Trophy aria-hidden size={18} /></span></div><div className="mt-4 h-2 overflow-hidden rounded-pill bg-surface-sunk" role="progressbar" aria-label="Monthly revenue target" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><div className="h-full rounded-pill bg-accent" style={{ width: `${progress}%` }} /></div><div className="mt-3 grid grid-cols-2 gap-2"><div className="rounded-lg bg-surface-sunk p-3"><p className="flex items-center gap-1 text-2xs font-semibold text-fg-muted"><IndianRupee aria-hidden size={12} /> Pipeline</p><strong className="tnum mt-1 block text-lg text-fg">{formatINRCompact(REVENUE.openPipeline)}</strong></div><div className="rounded-lg bg-warn-subtle p-3"><p className="flex items-center gap-1 text-2xs font-semibold text-warn"><Target aria-hidden size={12} /> Gap</p><strong className="tnum mt-1 block text-lg text-fg">{formatINRCompact(gap)}</strong></div></div><div className="mt-3 grid grid-cols-2 border-t border-border pt-2"><Link to="/leads" className="flex min-h-11 items-center gap-2 border-r border-border px-2 text-2xs font-semibold text-fg hover:bg-surface-sunk"><Flame aria-hidden size={13} className="text-warn" />{DIGEST.hotLeads} hot<ArrowRight aria-hidden size={12} className="ml-auto text-fg-subtle" /></Link><Link to="/leads" className="flex min-h-11 items-center gap-2 px-2 text-2xs font-semibold text-fg hover:bg-surface-sunk"><Snowflake aria-hidden size={13} className="text-info" />{DIGEST.goingCold} cooling<ArrowRight aria-hidden size={12} className="ml-auto text-fg-subtle" /></Link></div></section>

    <details className="group overflow-hidden rounded-xl border border-border bg-surface shadow-elev-1"><summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-4 text-xs font-semibold text-fg"><span className="flex h-8 w-8 items-center justify-center rounded-md bg-accent-subtle text-accent"><Sparkles aria-hidden size={15} /></span><span className="min-w-0 flex-1">My momentum and morning brief</span><ChevronDown aria-hidden size={15} className="text-fg-subtle transition-transform group-open:rotate-180" /></summary><div className="space-y-3 border-t border-border bg-surface-sunk p-3"><div className="rounded-lg bg-surface p-3"><p className="label-caps text-accent">Morning brief · Preview</p><p className="mt-2 text-xs font-semibold text-fg">Three deals deserve your best hour.</p><p className="mt-1 text-2xs leading-relaxed text-fg-muted">Yesterday: {DIGEST.yesterday.calls} calls, {DIGEST.yesterday.replies} replies, {formatINR(DIGEST.yesterday.closedValue)} closed.</p></div><MomentumCard /></div></details>
  </div>
}
