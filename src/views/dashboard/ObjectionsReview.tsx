import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Check,
  ChevronsUp,
  Maximize2,
  MessageSquareQuote,
  Target,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react'
import { Avatar } from '../../ui/Avatar'
import { Button } from '../../ui/Button'
import { Chip } from '../../ui/Chip'
import { EmptyState } from '../../ui/EmptyState'
import { ErrorState } from '../../ui/ErrorState'
import { Sheet } from '../../ui/Sheet'
import { Skeleton } from '../../ui/Skeleton'

export type ObjectionFrequencyPreview = {
  key: string
  label: string
  thisWeek: number
  lastWeek: number
  sample: true
}

export type RepCapturePreview = {
  id: string
  name: string
  captureRate: number
  conversations: number
  logged: number
  objections: Record<'Price' | 'Timing' | 'Trust' | 'Competitor', number>
  sample: true
}

export type ScriptPerformancePreview = {
  id: string
  objection: string
  version: number
  status: 'testing' | 'standard'
  uses: number
  wonAfterUse: number
  sample: true
}

const FREQUENCY: ObjectionFrequencyPreview[] = [
  { key: 'price', label: 'Price', thisWeek: 34, lastWeek: 27, sample: true },
  { key: 'timing', label: 'Timing', thisWeek: 22, lastWeek: 25, sample: true },
  { key: 'competitor', label: 'Competitor', thisWeek: 16, lastWeek: 11, sample: true },
  { key: 'trust', label: 'Trust', thisWeek: 11, lastWeek: 14, sample: true },
  { key: 'quality', label: 'Quality', thisWeek: 8, lastWeek: 6, sample: true },
]

const REP_CAPTURE: RepCapturePreview[] = [
  { id: 'r1', name: 'Asha Thomas', captureRate: 92, conversations: 38, logged: 35, objections: { Price: 12, Timing: 9, Trust: 5, Competitor: 9 }, sample: true },
  { id: 'r2', name: 'Nikhil S.', captureRate: 81, conversations: 42, logged: 34, objections: { Price: 14, Timing: 8, Trust: 7, Competitor: 5 }, sample: true },
  { id: 'r3', name: 'Arun P.', captureRate: 54, conversations: 35, logged: 19, objections: { Price: 8, Timing: 6, Trust: 3, Competitor: 2 }, sample: true },
  { id: 'r4', name: 'Diya Jose', captureRate: 37, conversations: 30, logged: 11, objections: { Price: 4, Timing: 3, Trust: 3, Competitor: 1 }, sample: true },
]

const SCRIPT_PERFORMANCE: ScriptPerformancePreview[] = [
  { id: 's1', objection: 'Price', version: 4, status: 'standard', uses: 126, wonAfterUse: 48, sample: true },
  { id: 's2', objection: 'Timing', version: 5, status: 'standard', uses: 109, wonAfterUse: 45, sample: true },
  { id: 's3', objection: 'Quality', version: 2, status: 'testing', uses: 42, wonAfterUse: 13, sample: true },
  { id: 's4', objection: 'Trust', version: 2, status: 'testing', uses: 37, wonAfterUse: 11, sample: true },
]

function FrequencyChart() {
  const max = Math.max(...FREQUENCY.flatMap((item) => [item.thisWeek, item.lastWeek]), 1)
  return (
    <svg viewBox="0 0 720 270" className="h-auto w-full" role="img" aria-label="Top objections this week compared with last week">
      {FREQUENCY.map((item, index) => {
        const y = 18 + index * 50
        const thisWidth = (item.thisWeek / max) * 490
        const lastWidth = (item.lastWeek / max) * 490
        return (
          <g key={item.key}>
            <text x="0" y={y + 19} fill="var(--fg-muted)" fontSize="12" fontWeight="600">{item.label}</text>
            <rect x="96" y={y + 2} width={lastWidth} height="10" rx="5" fill="var(--surface-sunk)" />
            <rect x="96" y={y + 17} width={thisWidth} height="14" rx="7" fill="var(--accent)" />
            <text x={Math.min(690, 106 + thisWidth)} y={y + 28} fill="var(--fg)" fontSize="12" fontWeight="650">{item.thisWeek}</text>
          </g>
        )
      })}
      <g transform="translate(96 260)"><circle r="4" fill="var(--accent)" /><text x="10" y="4" fill="var(--fg-muted)" fontSize="10">This week</text><circle cx="82" r="4" fill="var(--surface-sunk)" stroke="var(--border-strong)" /><text x="92" y="4" fill="var(--fg-muted)" fontSize="10">Last week</text></g>
    </svg>
  )
}

function ReviewMode({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0)
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowRight') setStep((value) => Math.min(3, value + 1))
      if (event.key === 'ArrowLeft') setStep((value) => Math.max(0, value - 1))
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [onClose])

  const slides = [
    <div key="signal" className="mx-auto max-w-4xl text-center"><span className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-accent-subtle text-accent"><TrendingUp aria-hidden size={30} /></span><p className="label-caps mt-8 text-accent">This week’s signal</p><h3 className="mt-4 text-4xl font-semibold tracking-[-0.055em] text-fg sm:text-6xl">Price objections rose <span className="text-accent">26%</span>.</h3><p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-fg-muted">Most came after the fee PDF, before a rep explained what weekly mentoring includes.</p></div>,
    <div key="behavior" className="mx-auto max-w-4xl text-center"><span className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-warn-subtle text-warn"><Target aria-hidden size={30} /></span><p className="label-caps mt-8 text-warn">Coached behavior</p><h3 className="mt-4 text-4xl font-semibold tracking-[-0.055em] text-fg sm:text-6xl">Two reps log fewer than <span className="text-warn">6 in 10</span>.</h3><p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-fg-muted">Coach the habit, not the number: capture immediately, then use the script as the reward.</p></div>,
    <div key="script" className="mx-auto max-w-4xl text-center"><span className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-success-subtle text-success"><MessageSquareQuote aria-hidden size={30} /></span><p className="label-caps mt-8 text-success">What works</p><h3 className="mt-4 text-4xl font-semibold tracking-[-0.055em] text-fg sm:text-6xl">Timing v5 wins after use <span className="text-success">41%</span>.</h3><p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-fg-muted">“Start date, decision date, or payment date?” is the phrase to rehearse in today’s role-play.</p></div>,
    <div key="decision" className="mx-auto max-w-4xl text-center"><span className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-accent-subtle text-accent"><ChevronsUp aria-hidden size={30} /></span><p className="label-caps mt-8 text-accent">Manager decision</p><h3 className="mt-4 text-4xl font-semibold tracking-[-0.055em] text-fg sm:text-6xl">Keep Quality v2 <span className="text-accent">testing</span>.</h3><p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-fg-muted">42 uses is directional, not enough for a standard. Review again after 75 uses.</p></div>,
  ]

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-canvas" role="dialog" aria-modal="true" aria-label="Weekly objections review">
      <header className="flex h-16 shrink-0 items-center gap-4 border-b border-border bg-surface px-5"><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-fg">Monday objection review</p><p className="text-2xs text-fg-muted">Preview — not wired · Use arrow keys</p></div><span className="tnum text-xs text-fg-muted">{step + 1} / {slides.length}</span><button onClick={onClose} aria-label="Close review mode" className="flex h-9 w-9 items-center justify-center rounded-md text-fg-muted hover:bg-surface-sunk hover:text-fg"><X aria-hidden size={18} /></button></header>
      <main className="flex min-h-0 flex-1 items-center overflow-y-auto px-6 py-12">{slides[step]}</main>
      <footer className="flex shrink-0 items-center justify-between border-t border-border bg-surface px-5 py-4"><Button variant="secondary" onClick={() => setStep((value) => Math.max(0, value - 1))} disabled={step === 0}><ArrowLeft aria-hidden size={14} /> Previous</Button><div className="flex gap-1.5">{slides.map((_, index) => <button key={index} onClick={() => setStep(index)} aria-label={`Go to review insight ${index + 1}`} aria-current={step === index ? 'step' : undefined} className={['h-2 rounded-pill transition-[width,background-color]', step === index ? 'w-8 bg-accent' : 'w-2 bg-border-strong'].join(' ')} />)}</div><Button onClick={() => step === slides.length - 1 ? onClose() : setStep((value) => value + 1)}>{step === slides.length - 1 ? 'Finish review' : 'Next insight'} {step < slides.length - 1 && <ArrowRight aria-hidden size={14} />}</Button></footer>
    </div>
  )
}

export function ObjectionsReview({ previewState = 'ready' }: { previewState?: 'ready' | 'loading' | 'empty' | 'error' }) {
  const [reviewOpen, setReviewOpen] = useState(false)
  const [promote, setPromote] = useState<ScriptPerformancePreview | null>(null)
  const [promoted, setPromoted] = useState<string[]>([])
  const matrixMax = useMemo(() => Math.max(...REP_CAPTURE.flatMap((rep) => Object.values(rep.objections)), 1), [])

  if (previewState === 'loading') return <div className="space-y-3"><Skeleton className="h-16" /><Skeleton className="h-64" /><Skeleton className="h-48" /></div>
  if (previewState === 'empty') return <EmptyState icon={BarChart3} title="No objections logged this week." body="Once reps capture objections, frequency and script performance appear here." />
  if (previewState === 'error') return <ErrorState title="Couldn’t load objection review" body="Try again before the team meeting." onRetry={() => undefined} />

  return (
    <section className="space-y-4" aria-labelledby="objections-review-title">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="label-caps text-accent">Closed-loop learning · Preview</p><h2 id="objections-review-title" className="mt-1 text-xl font-semibold tracking-[-0.03em] text-fg">Objections</h2><p className="mt-1 text-xs text-fg-muted">What customers resist, who captures it, and which answer changes the outcome.</p></div><Button onClick={() => setReviewOpen(true)}><Maximize2 aria-hidden size={15} /> Start weekly review</Button></div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,.75fr)]">
        <article className="rounded-xl border border-border bg-surface p-4 shadow-elev-1"><div className="flex items-center justify-between"><div><h3 className="text-sm font-semibold text-fg">Top objections</h3><p className="mt-1 text-2xs text-fg-muted">This week against last week</p></div><span className="flex items-center gap-1 text-xs font-semibold text-danger"><TrendingUp aria-hidden size={13} /> Price +26%</span></div><div className="mt-4"><FrequencyChart /></div></article>
        <article className="rounded-xl border border-border bg-surface p-4 shadow-elev-1"><h3 className="text-sm font-semibold text-fg">This week’s readout</h3><div className="mt-4 space-y-3">{[{ icon: TrendingUp, tone: 'text-danger bg-danger-subtle', label: 'Price is rising', detail: '34 logs · up 7 week over week' }, { icon: TrendingDown, tone: 'text-success bg-success-subtle', label: 'Timing is easing', detail: '22 logs · down 3 week over week' }, { icon: Target, tone: 'text-warn bg-warn-subtle', label: 'Capture habit gap', detail: '2 reps below the 60% coaching line' }].map((item) => <div key={item.label} className="flex gap-3 rounded-lg bg-surface-sunk p-3"><span className={['flex h-8 w-8 shrink-0 items-center justify-center rounded-md', item.tone].join(' ')}><item.icon aria-hidden size={15} /></span><span><strong className="block text-xs text-fg">{item.label}</strong><span className="mt-0.5 block text-2xs text-fg-muted">{item.detail}</span></span></div>)}</div></article>
      </div>

      <article className="overflow-hidden rounded-xl border border-border bg-surface shadow-elev-1"><div className="flex items-end justify-between gap-3 border-b border-border p-4"><div><h3 className="text-sm font-semibold text-fg">Capture behavior by rep</h3><p className="mt-1 text-2xs text-fg-muted">Capture rate is a coached habit, not a performance score.</p></div><span className="label-caps">Goal ≥ 80%</span></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] border-collapse text-xs"><thead><tr className="bg-surface-sunk text-fg-subtle">{['Rep', 'Capture rate', 'Price', 'Timing', 'Trust', 'Competitor', 'Logged'].map((label, index) => <th key={label} className={['px-4 py-2.5 font-semibold', index === 0 ? 'text-left' : 'text-center'].join(' ')}>{label}</th>)}</tr></thead><tbody>{REP_CAPTURE.map((rep) => <tr key={rep.id} className="border-t border-border"><td className="px-4 py-3"><span className="flex items-center gap-2"><Avatar name={rep.name} size="sm" /><span className="font-semibold text-fg">{rep.name}</span></span></td><td className="px-4 py-3"><div className="mx-auto flex w-32 items-center gap-2"><div className="h-2 flex-1 overflow-hidden rounded-pill bg-surface-sunk"><div className={['h-full rounded-pill', rep.captureRate >= 80 ? 'bg-success' : rep.captureRate >= 60 ? 'bg-warn' : 'bg-danger'].join(' ')} style={{ width: `${rep.captureRate}%` }} /></div><strong className="tnum w-8 text-right text-fg">{rep.captureRate}%</strong></div></td>{(['Price', 'Timing', 'Trust', 'Competitor'] as const).map((key) => { const value = rep.objections[key]; const opacity = 0.12 + (value / matrixMax) * 0.7; return <td key={key} className="px-4 py-3 text-center"><span className="tnum inline-flex h-8 min-w-8 items-center justify-center rounded-md font-semibold text-accent" style={{ background: `color-mix(in srgb, var(--accent) ${Math.round(opacity * 100)}%, transparent)` }}>{value}</span></td> })}<td className="tnum px-4 py-3 text-center text-fg-muted">{rep.logged}/{rep.conversations}</td></tr>)}</tbody></table></div></article>

      <article className="overflow-hidden rounded-xl border border-border bg-surface shadow-elev-1"><div className="border-b border-border p-4"><h3 className="text-sm font-semibold text-fg">Script performance</h3><p className="mt-1 text-2xs text-fg-muted">Directional preview: use counts and won-after-use need server attribution.</p></div><div className="divide-y divide-border">{SCRIPT_PERFORMANCE.map((script) => { const rate = Math.round((script.wonAfterUse / script.uses) * 100); const isPromoted = promoted.includes(script.id) || script.status === 'standard'; return <div key={script.id} className="flex flex-wrap items-center gap-3 px-4 py-3"><span className="flex h-9 w-9 items-center justify-center rounded-md bg-accent-subtle text-sm font-bold text-accent">{script.objection.slice(0, 1)}</span><div className="min-w-32 flex-1"><div className="flex items-center gap-2"><span className="text-sm font-semibold text-fg">{script.objection} v{script.version}</span><Chip tone={isPromoted ? 'success' : 'warn'}>{isPromoted ? 'Standard' : 'Testing'}</Chip></div><p className="mt-0.5 text-2xs text-fg-muted">{script.uses} uses · {script.wonAfterUse} wins after use</p></div><strong className="tnum text-lg text-fg">{rate}%</strong>{script.status === 'testing' && !promoted.includes(script.id) && <Button size="sm" variant="secondary" onClick={() => setPromote(script)}><ChevronsUp aria-hidden size={14} /> Promote</Button>}</div> })}</div></article>

      {reviewOpen && <ReviewMode onClose={() => setReviewOpen(false)} />}
      <Sheet open={!!promote} onClose={() => setPromote(null)} title="Promote from weekly review?">{promote && <><p className="text-sm leading-relaxed text-fg-muted"><strong className="text-fg">{promote.objection} v{promote.version}</strong> becomes the company standard. Reps will see it first after logging this objection.</p><div className="mt-4 rounded-lg bg-surface-sunk p-3 text-xs text-fg-muted">{promote.uses} uses · {promote.wonAfterUse} wins after use · Preview attribution</div><Button className="mt-4 w-full" onClick={() => { setPromoted((all) => [...all, promote.id]); setPromote(null) }}><Check aria-hidden size={14} /> Promote to standard</Button><p className="mt-2 text-center text-2xs text-fg-subtle">Preview — action is not wired</p></>}</Sheet>
    </section>
  )
}
