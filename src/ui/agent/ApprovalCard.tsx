import { useState } from 'react'
import { ArrowRight, ShieldCheck } from 'lucide-react'
import { Button } from '../Button'
import { StatusBadge } from './primitives'
import type { ProposedAction } from '../../lib/mock-wave3'

// The approval ladder made visible (C-R laws): auto = already done, one-tap =
// a single confirm, explicit = deliberate emphasis. Every card answers: WHAT
// will happen, WHO it affects, before → after, WHY — then Cancel/Edit always.

const TIER: Record<ProposedAction['tier'], { label: string; tone: 'neutral' | 'accent' | 'warn' }> = {
  auto: { label: 'Automatic', tone: 'neutral' },
  one_tap: { label: 'One tap', tone: 'accent' },
  explicit: { label: 'Needs approval', tone: 'warn' },
}

export function ApprovalCard({
  proposal,
  onDecide,
}: {
  proposal: ProposedAction
  /** UI-only: parent records the local decision (mock — nothing executes). */
  onDecide?: (id: string, decision: 'approved' | 'edited' | 'cancelled') => void
}) {
  const [decision, setDecision] = useState<null | 'approved' | 'edited' | 'cancelled'>(null)
  const tier = TIER[proposal.tier]
  const decide = (d: 'approved' | 'edited' | 'cancelled') => {
    setDecision(d)
    onDecide?.(proposal.id, d)
  }

  return (
    <section
      className="rounded-md border border-border bg-surface p-3.5 shadow-elev-1"
      aria-label={`Proposed action: ${proposal.title}`}
    >
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-fg">{proposal.title}</h4>
        <StatusBadge tone={tier.tone}>{tier.label}</StatusBadge>
      </div>

      <p className="mt-1 truncate text-2xs text-fg-subtle">{proposal.target}</p>
      <p className="mt-2 text-xs text-fg">{proposal.what}</p>

      {proposal.before && proposal.after && (
        <p className="tnum mt-1.5 flex items-center gap-1.5 text-xs">
          <span className="rounded-sm bg-surface-sunk px-1.5 py-0.5 text-fg-muted line-through decoration-border-strong">
            {proposal.before}
          </span>
          <ArrowRight aria-hidden size={12} className="text-fg-subtle" />
          <span className="rounded-sm bg-accent-subtle px-1.5 py-0.5 font-medium text-accent">
            {proposal.after}
          </span>
        </p>
      )}

      <p className="mt-2 text-2xs text-fg-muted">Why: {proposal.why}</p>

      {decision ? (
        <p
          className={[
            'mt-3 flex items-center gap-1.5 text-xs font-medium',
            decision === 'cancelled' ? 'text-fg-muted' : 'text-success',
          ].join(' ')}
          role="status"
        >
          <ShieldCheck aria-hidden size={14} />
          {decision === 'approved' && (proposal.tier === 'explicit' ? 'Approved — will send' : 'Done')}
          {decision === 'edited' && 'Opened for editing'}
          {decision === 'cancelled' && 'Cancelled — nothing changed'}
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={proposal.tier === 'explicit' ? 'primary' : 'secondary'}
            onClick={() => decide('approved')}
          >
            {proposal.tier === 'explicit' ? 'Approve & send' : 'Confirm'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => decide('edited')}>
            Edit
          </Button>
          <Button size="sm" variant="ghost" onClick={() => decide('cancelled')}>
            Cancel
          </Button>
        </div>
      )}
    </section>
  )
}
