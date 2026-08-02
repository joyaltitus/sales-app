import { ArrowRight, Flame, IndianRupee, Snowflake, Sparkles, Target, Trophy } from 'lucide-react'
import { Link } from 'react-router-dom'
import { MomentumCard } from '../momentum/RepMomentum'

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
  return <div className="mt-4 space-y-4">
    <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-elev-1"><div className="flex items-start gap-3 p-4"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-subtle text-accent"><Sparkles aria-hidden size={18} /></span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><p className="label-caps text-accent">Copilot morning brief · Preview</p><span className="text-2xs text-fg-subtle">8:02 am</span></div><h2 className="mt-1 text-md font-semibold text-fg">Three deals deserve your best hour.</h2><p className="mt-1 text-xs leading-relaxed text-fg-muted">Yesterday: {DIGEST.yesterday.calls} calls, {DIGEST.yesterday.replies} replies, ₹{DIGEST.yesterday.closedValue.toLocaleString('en-IN')} closed.</p><p className="mt-2 text-2xs font-semibold text-success">Momentum: 2 on-time follow-ups from your best week.</p></div></div><div className="grid grid-cols-2 border-t border-border"><Link to="/leads" className="flex min-h-12 items-center gap-2 border-r border-border px-4 text-xs font-semibold text-fg hover:bg-surface-sunk"><Flame aria-hidden size={14} className="text-warn" />{DIGEST.hotLeads} hot leads<ArrowRight aria-hidden size={13} className="ml-auto text-fg-subtle" /></Link><Link to="/leads" className="flex min-h-12 items-center gap-2 px-4 text-xs font-semibold text-fg hover:bg-surface-sunk"><Snowflake aria-hidden size={14} className="text-info" />{DIGEST.goingCold} going cold<ArrowRight aria-hidden size={13} className="ml-auto text-fg-subtle" /></Link></div></section>

    <MomentumCard />

    <section className="rounded-xl border border-border bg-surface p-4 shadow-elev-1"><div className="flex items-start justify-between gap-4"><div><p className="label-caps">Your {REVENUE.month}</p><h2 className="mt-1 text-md font-semibold text-fg">₹{REVENUE.closed.toLocaleString('en-IN')} closed</h2><p className="mt-1 text-xs text-fg-muted">of ₹{REVENUE.target.toLocaleString('en-IN')} target</p></div><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-success-subtle text-success"><Trophy aria-hidden size={18} /></span></div><div className="mt-4 h-2 overflow-hidden rounded-pill bg-surface-sunk" role="progressbar" aria-label="Monthly revenue target" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><div className="h-full rounded-pill bg-accent" style={{ width: `${progress}%` }} /></div><div className="mt-3 grid grid-cols-2 gap-3"><div className="rounded-lg bg-surface-sunk p-3"><p className="flex items-center gap-1 text-2xs font-semibold text-fg-muted"><IndianRupee aria-hidden size={12} /> Open pipeline</p><strong className="tnum mt-1 block text-lg text-fg">₹{(REVENUE.openPipeline / 100000).toFixed(1)}L</strong></div><div className="rounded-lg bg-warn-subtle p-3"><p className="flex items-center gap-1 text-2xs font-semibold text-warn"><Target aria-hidden size={12} /> Coverage gap</p><strong className="tnum mt-1 block text-lg text-fg">₹{(gap / 100000).toFixed(1)}L</strong></div></div><p className="mt-3 text-xs leading-relaxed text-fg-muted">Add <strong className="text-fg">₹{gap.toLocaleString('en-IN')}</strong> more qualified pipeline to hold 2.2× coverage.</p></section>
  </div>
}
