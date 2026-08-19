import { ShieldCheck } from 'lucide-react'
import { Button } from '../Button'
import { StatusBadge } from './primitives'
import type { ChecklistItem, ChecklistStatus } from '../../lib/agent-chat'

// The approval ladder made visible (C-R laws): one-tap = a single confirm,
// explicit = deliberate emphasis. Decisions here are LOCAL only — nothing
// executes until the panel batches every card's decision into one
// POST /api/agent-approve (hub-service clears the whole pending plan on that
// single call; anything not named there is dismissed, so there is no
// per-card network call to make).

const TIER: Record<ChecklistItem['tier'], { label: string; tone: 'neutral' | 'accent' | 'warn' }> = {
  auto: { label: 'Automatic', tone: 'neutral' },
  one_tap: { label: 'One tap', tone: 'accent' },
  explicit: { label: 'Needs approval', tone: 'warn' },
}

const TERMINAL: Partial<Record<ChecklistStatus, { text: string; tone: 'success' | 'muted' | 'danger' }>> = {
  executed: { text: 'Done', tone: 'success' },
  confirmed: { text: 'Approved — running', tone: 'success' },
  failed: { text: 'Failed', tone: 'danger' },
  blocked: { text: 'Blocked by another step', tone: 'muted' },
  dismissed: { text: 'Cancelled — nothing changed', tone: 'muted' },
}

function humanize(tool: string): string {
  return tool.replaceAll('_', ' ').replace(/^./, (c) => c.toUpperCase())
}

export function ApprovalCard({
  item,
  decision,
  onDecide,
}: {
  item: ChecklistItem
  /** The panel's pending local decision for this card, before the batch submit. */
  decision: 'approved' | 'cancelled' | null
  onDecide?: (id: string, decision: 'approved' | 'cancelled') => void
}) {
  const tier = TIER[item.tier]
  const terminal = TERMINAL[item.status]
  const summaryEntries = Object.entries(item.summary)

  return (
    <section
      className="rounded-md border border-border bg-surface p-3.5 shadow-elev-1"
      aria-label={`Proposed action: ${humanize(item.tool)}`}
    >
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-fg">{humanize(item.tool)}</h4>
        <StatusBadge tone={tier.tone}>{tier.label}</StatusBadge>
      </div>

      {summaryEntries.length > 0 && (
        <dl className="mt-2 space-y-0.5 text-xs text-fg">
          {summaryEntries.map(([key, value]) => (
            <div key={key} className="flex gap-1.5">
              <dt className="shrink-0 text-fg-subtle">{humanize(key)}:</dt>
              <dd className="truncate">{String(value)}</dd>
            </div>
          ))}
        </dl>
      )}

      {item.error && <p className="mt-2 text-2xs text-danger">{item.error}</p>}

      {terminal ? (
        <p
          className={[
            'mt-3 flex items-center gap-1.5 text-xs font-medium',
            terminal.tone === 'success' ? 'text-success' : terminal.tone === 'danger' ? 'text-danger' : 'text-fg-muted',
          ].join(' ')}
          role="status"
        >
          <ShieldCheck aria-hidden size={14} />
          {terminal.text}
        </p>
      ) : decision ? (
        <p className={['mt-3 flex items-center gap-1.5 text-xs font-medium', decision === 'cancelled' ? 'text-fg-muted' : 'text-success'].join(' ')} role="status">
          <ShieldCheck aria-hidden size={14} />
          {decision === 'approved' ? 'Marked to approve — submit to run' : 'Marked to cancel'}
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button size="sm" variant={item.tier === 'explicit' ? 'primary' : 'secondary'} onClick={() => onDecide?.(item.id, 'approved')}>
            {item.tier === 'explicit' ? 'Approve & send' : 'Confirm'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onDecide?.(item.id, 'cancelled')}>
            Cancel
          </Button>
        </div>
      )}
    </section>
  )
}
