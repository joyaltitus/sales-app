import { lazy, Suspense, useState } from 'react'
import { Gauge } from 'lucide-react'
import type { LeadItem, LeadStage } from '../../lib/leads-data'

const ProbabilityExplanation = lazy(() => import('./ProbabilityExplanation').then((module) => ({ default: module.ProbabilityExplanation })))

export function estimateDealProbability(lead: LeadItem, stages: LeadStage[]) {
  if (lead.status === 'won') return 100
  if (lead.status === 'lost') return 0

  const orderedStages = [...stages].sort((a, b) => a.sort_order - b.sort_order)
  const stageIndex = Math.max(0, orderedStages.findIndex((stage) => stage.id === lead.stage_id))
  const stageProgress = orderedStages.length > 1 ? stageIndex / (orderedStages.length - 1) : 0.35
  let probability = 18 + stageProgress * 62

  if (lead.temperature_override === 'hot') probability += 9
  if (lead.temperature_override === 'cold') probability -= 8
  if (lead.next_action) probability += 3
  if (lead.objection) probability -= 4

  const lastActivity = new Date(lead.conversation?.last_customer_message_at ?? lead.updated_at).getTime()
  const ageDays = (Date.now() - lastActivity) / 86_400_000
  if (ageDays <= 2) probability += 4
  if (ageDays > 14) probability -= 9

  // A small stable offset prevents every deal in the same stage presenting as
  // identical while keeping the visible score deterministic across reloads.
  const stableOffset = [...lead.id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 5 - 2
  return Math.round(Math.min(95, Math.max(8, probability + stableOffset)))
}

export function DealProbability({ probability, person = 'this deal' }: { probability: number; person?: string }) {
  const [open, setOpen] = useState(false)
  const tone = probability >= 70 ? 'border-success/25 bg-success-subtle text-success' : probability >= 45 ? 'border-warn/25 bg-warn-subtle text-warn' : 'border-border bg-surface-sunk text-fg-muted'
  return <><button onClick={(event) => { event.stopPropagation(); setOpen(true) }} className={['inline-flex min-h-8 shrink-0 items-center gap-1 rounded-pill border px-2 text-2xs font-semibold', tone].join(' ')} aria-label={`Stage signal ${probability} for ${person}`} title="Stage-based signal — open calculation details"><Gauge aria-hidden size={11} />{probability}</button>{open && <Suspense fallback={null}><ProbabilityExplanation open probability={probability} person={person} onClose={() => setOpen(false)} /></Suspense>}</>
}
