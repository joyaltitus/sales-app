import { useState } from 'react'
import { StatusBadge, EvidenceLink } from './primitives'
import { Button } from '../Button'
import {
  FACT_CATEGORY_LABEL,
  type LeadFact,
  type FactState,
} from '../../lib/lead-facts'

// Lead Brain fact — the customer's own words distilled, never a black box:
// state is explicit, confidence is shown, evidence is one tap away, and a
// SUGGESTED fact does nothing until a human confirms it.

const STATE_TONE: Record<FactState, 'accent' | 'success' | 'warn' | 'neutral'> = {
  suggested: 'accent',
  confirmed: 'success',
  corrected: 'warn',
  retired: 'neutral',
}

const STATE_LABEL: Record<FactState, string> = {
  suggested: 'Suggested',
  confirmed: 'Confirmed',
  corrected: 'Corrected',
  retired: 'Retired',
}

export function FactCard({
  fact,
  compact = false,
  onDecide,
}: {
  fact: LeadFact
  /** compact = context-rail density; full = Memory tab */
  compact?: boolean
  onDecide?: (id: string, decision: 'confirmed' | 'edited' | 'dismissed') => void
}) {
  const [decision, setDecision] = useState<null | string>(null)
  const [showHistory, setShowHistory] = useState(false)
  const pct = Math.round(fact.confidence * 100)

  return (
    <div className="rounded-md border border-border bg-surface p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="label-caps">{FACT_CATEGORY_LABEL[fact.category]}</span>
        <span className="flex items-center gap-1.5">
          {!compact && (
            <span className="tnum text-2xs text-fg-subtle" title="Extraction confidence">
              {pct}%
            </span>
          )}
          <StatusBadge tone={STATE_TONE[fact.state]}>{STATE_LABEL[fact.state]}</StatusBadge>
        </span>
      </div>

      <p className={['mt-1 text-fg', compact ? 'text-xs' : 'text-sm'].join(' ')}>{fact.value}</p>

      <div className="mt-1.5">
        <EvidenceLink
          quote={fact.evidence.quote}
          meta={`${fact.evidence.channel === 'whatsapp' ? 'WhatsApp' : 'Instagram'} · ${new Date(fact.evidence.at).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`}
        />
      </div>

      {!compact && fact.history && fact.history.length > 0 && (
        <div className="mt-1.5">
          <button
            onClick={() => setShowHistory((v) => !v)}
            aria-expanded={showHistory}
            className="text-2xs text-fg-subtle underline decoration-border-strong underline-offset-2 hover:text-fg-muted"
          >
            {showHistory ? 'Hide correction history' : 'Correction history'}
          </button>
          {showHistory &&
            fact.history.map((c, i) => (
              <p key={i} className="mt-1 text-2xs text-fg-muted">
                “{c.from}” → “{c.to}” — {c.by},{' '}
                {new Date(c.at).toLocaleDateString([], { day: 'numeric', month: 'short' })}
              </p>
            ))}
        </div>
      )}

      {fact.state === 'suggested' &&
        (decision ? (
          <p className="mt-2 text-2xs font-medium text-fg-muted" role="status">
            {decision === 'confirmed' ? 'Confirmed' : decision === 'edited' ? 'Opened for edit' : 'Dismissed'}
          </p>
        ) : (
          <div className="mt-2 flex gap-1.5">
            <Button
              size="sm"
              variant="secondary"
              className="h-7 px-2.5 text-2xs"
              onClick={() => {
                setDecision('confirmed')
                onDecide?.(fact.id, 'confirmed')
              }}
            >
              Confirm
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-2xs"
              onClick={() => {
                setDecision('edited')
                onDecide?.(fact.id, 'edited')
              }}
            >
              Edit
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-2xs"
              onClick={() => {
                setDecision('dismissed')
                onDecide?.(fact.id, 'dismissed')
              }}
            >
              Dismiss
            </Button>
          </div>
        ))}
    </div>
  )
}
