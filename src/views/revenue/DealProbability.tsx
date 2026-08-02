import { lazy, Suspense, useState } from 'react'
import { Gauge } from 'lucide-react'

const ProbabilityExplanation = lazy(() => import('./ProbabilityExplanation').then((module) => ({ default: module.ProbabilityExplanation })))

export function DealProbability({ probability = 68, person = 'this deal' }: { probability?: number; person?: string }) {
  const [open, setOpen] = useState(false)
  const tone = probability >= 70 ? 'border-success/25 bg-success-subtle text-success' : probability >= 45 ? 'border-warn/25 bg-warn-subtle text-warn' : 'border-border bg-surface-sunk text-fg-muted'
  return <><button onClick={(event) => { event.stopPropagation(); setOpen(true) }} className={['inline-flex min-h-7 shrink-0 items-center gap-1 rounded-pill border px-2 text-2xs font-semibold', tone].join(' ')} aria-label={`${probability}% estimated win probability for ${person}`} title="Preview AI estimate — tap for reasons"><Gauge aria-hidden size={11} />{probability}%</button>{open && <Suspense fallback={null}><ProbabilityExplanation open probability={probability} person={person} onClose={() => setOpen(false)} /></Suspense>}</>
}

