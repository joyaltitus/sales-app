import type { ReactNode } from 'react'
import type { LeadDetail, TimelineEntry } from '../lib/contracts'
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronDown,
  ListChecks,
  MessageSquare,
  Phone,
  ShieldAlert,
  StickyNote,
} from 'lucide-react'
import { Avatar } from '../../src/ui/Avatar'
import { Button } from '../../src/ui/Button'
import { ChannelIcon } from '../../src/ui/ChannelIcon'
import { Chip } from '../../src/ui/Chip'
import { EmptyState } from '../../src/ui/EmptyState'
import { ReferenceSkeleton } from './Skeletons'
import { formatDay } from './time'

type Props = {
  detail: LeadDetail
  /** When set and different from lead.owner.user_id, renders the quiet "Owned by" line. */
  viewerId?: string
  onBack?: () => void
  onOpenChat?: () => void
  onCall?: () => void
  workspace?: ReactNode
  /** Reference data still in flight — hold its height instead of popping in. */
  pending?: boolean
}

const SOURCE_LABEL = { api: 'AI transcript', rep: 'Rep declared', both: 'AI + rep' } as const

const KIND_META: Record<TimelineEntry['kind'], { icon: typeof MessageSquare; label: string }> = {
  message: { icon: MessageSquare, label: 'Message' },
  call_log: { icon: Phone, label: 'Call' },
  note: { icon: StickyNote, label: 'Note' },
  objection: { icon: ShieldAlert, label: 'Objection' },
}

// summary is outside the global :focus-visible selector list, so reference
// disclosures carry their own ring — same accent + offset, same tokens.
const summaryClass =
  'flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg px-3 select-none hover:bg-surface-sunk focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent [&::-webkit-details-marker]:hidden'

/** Reference material: readable before the call, out of the way during it. */
function Reference({
  label,
  icon: Icon,
  count,
  children,
}: {
  label: string
  icon: typeof MessageSquare
  count?: number
  children: ReactNode
}) {
  return (
    <section aria-label={label}>
      <details className="group overflow-hidden rounded-lg border border-border bg-surface">
        <summary className={summaryClass}>
          <Icon aria-hidden size={14} strokeWidth={1.9} className="shrink-0 text-fg-subtle" />
          <span className="label-caps">{label}</span>
          {count != null && <span className="text-2xs text-fg-subtle tnum">{count}</span>}
          <ChevronDown
            aria-hidden
            size={15}
            className="ml-auto shrink-0 text-fg-subtle transition-transform duration-[var(--motion-fast)] group-open:rotate-180"
          />
        </summary>
        <div className="border-t border-border">{children}</div>
      </details>
    </section>
  )
}

function EntryBody({ entry }: { entry: TimelineEntry }) {
  switch (entry.kind) {
    case 'message':
      return (
        <p className="text-xs leading-relaxed text-fg-muted">
          <span aria-hidden className="mr-1 inline-flex align-[-2px]">
            {entry.direction === 'in' ? (
              <ArrowDownLeft size={12} className="text-info" />
            ) : (
              <ArrowUpRight size={12} className="text-success" />
            )}
          </span>
          {entry.body ?? `(${entry.msg_type})`}
        </p>
      )
    case 'call_log':
      return (
        <p className="flex flex-wrap items-center gap-1.5 text-xs text-fg-muted">
          <Chip tone={entry.outcome === 'closed' ? 'success' : 'neutral'}>{entry.outcome}</Chip>
          {entry.note && <span className="min-w-0 flex-1">{entry.note}</span>}
        </p>
      )
    case 'note':
      return <p className="text-xs leading-relaxed text-fg-muted">{entry.body}</p>
    case 'objection':
      return <Chip tone="danger">{entry.label}</Chip>
  }
}

export function LeadScreen({ detail, viewerId, onBack, onOpenChat, onCall, workspace, pending }: Props) {
  const { lead, facts, objections, timeline } = detail
  const ownedByOther = lead.owner != null && lead.owner.user_id !== viewerId

  return (
    <div>
      {/* Who, what stage, one primary action. Status only earns a chip when it
          is no longer the default — an "open" pill on every open lead is noise. */}
      <header className="sticky top-0 z-10 border-b border-border bg-surface px-3 py-2">
        <div className="flex items-center gap-2">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back to queue" className="-ml-2 h-11 w-11">
              <ArrowLeft aria-hidden size={18} strokeWidth={1.75} />
            </Button>
          )}
          <Avatar name={lead.display_name} />
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <h2 className="truncate text-md font-semibold tracking-[-0.015em] text-fg">{lead.display_name}</h2>
            <ChannelIcon channel={lead.channel === 'phone' ? null : lead.channel} />
          </div>
          {lead.phone_e164 && (
            <Button size="sm" className="min-h-11 shrink-0 px-3" onClick={onOpenChat}>
              Open chat
            </Button>
          )}
        </div>
        <div className="mt-1 flex items-center gap-1.5 pl-1">
          <span className="min-w-0 truncate text-2xs text-fg-subtle">{lead.stage_label}</span>
          {lead.status !== 'open' && (
            <Chip tone={lead.status === 'won' ? 'success' : 'danger'}>{lead.status}</Chip>
          )}
          {ownedByOther && (
            <>
              <span aria-hidden className="text-2xs text-fg-subtle">·</span>
              <span className="truncate text-2xs text-fg-subtle">Owned by {lead.owner?.display_name ?? 'another rep'}</span>
            </>
          )}
          {lead.phone_e164 ? (
            <button
              type="button"
              onClick={onCall}
              className="ml-auto flex min-h-11 shrink-0 items-center gap-1 rounded-md px-1.5 text-2xs font-medium text-fg-muted transition-colors select-none tnum hover:bg-surface-sunk hover:text-fg"
            >
              <Phone aria-hidden size={12} strokeWidth={2} />
              {lead.phone_e164}
            </button>
          ) : (
            <span className="ml-auto shrink-0 text-2xs text-fg-subtle">No phone number captured</span>
          )}
        </div>
      </header>

      {/* Everything the rep touches mid-call lives here, first, unscrolled. */}
      {workspace}

      <div className="space-y-2 px-3 pt-1 pb-4">
        <div className="flex items-center gap-2 pt-1">
          <span className="h-px flex-1 bg-border" />
          <span className="label-caps">Before the call</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        {pending && <ReferenceSkeleton />}

        {/* All three always render, at 0 too: a section that silently vanishes
            reads the same as one that failed to load, and three fixed rows let
            the skeleton above reserve the exact final height. */}
        {!pending && (
          <Reference label="Facts" icon={ListChecks} count={facts.length}>
            {facts.length === 0 ? (
              <p className="px-3 py-2 text-xs text-fg-subtle">Nothing captured yet.</p>
            ) : (
            <ul>
              {facts.map((fact) => (
                <li key={fact.id} className="flex items-start gap-2 border-b border-border px-3 py-2 last:border-b-0">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm capitalize text-fg">{fact.fact_key.replace(/_/g, ' ')}</span>
                    <span className="block truncate text-xs text-fg-muted tnum">{String(fact.value)}</span>
                  </span>
                  {fact.status === 'confirmed' ? (
                    <Chip tone="success">
                      <Check aria-hidden size={11} /> confirmed
                    </Chip>
                  ) : (
                    <Chip tone="warn" className="border-dashed">
                      suggested{fact.confidence != null ? ` · ${Math.round(fact.confidence * 100)}%` : ''}
                    </Chip>
                  )}
                </li>
              ))}
            </ul>
            )}
          </Reference>
        )}

        {!pending && (
          <Reference label="Objections" icon={ShieldAlert} count={objections.length}>
            {objections.length === 0 ? (
              <p className="px-3 py-2 text-xs text-fg-subtle">None raised yet.</p>
            ) : (
            <ul>
              {objections.map((objection) => (
                <li
                  key={objection.id}
                  className="flex items-center gap-2 border-b border-border px-3 py-2 text-xs last:border-b-0"
                >
                  <ShieldAlert aria-hidden size={13} className="shrink-0 text-danger" />
                  <span className="min-w-0 flex-1 truncate font-medium text-fg">{objection.label}</span>
                  <span className="shrink-0 text-2xs text-fg-subtle tnum">{formatDay(objection.occurred_at)}</span>
                </li>
              ))}
            </ul>
            )}
          </Reference>
        )}

        {!pending && (
          <Reference label="History" icon={MessageSquare} count={timeline.length}>
          {timeline.length === 0 ? (
            <EmptyState title="No history yet" body="Declared calls and the AI transcript land here." />
          ) : (
            <ol className="space-y-2.5 p-3">
              {timeline.map((entry, index) => {
                const meta = KIND_META[entry.kind]
                const Icon = meta.icon
                const fromApi = entry.source === 'api'
                return (
                  <li key={`${entry.at}-${entry.kind}-${index}`} className="flex items-start gap-2.5">
                    <span
                      className={[
                        'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border',
                        fromApi
                          ? 'border-[color-mix(in_srgb,var(--accent)_25%,transparent)] bg-accent-subtle text-accent'
                          : 'border-border bg-surface-sunk text-fg-muted',
                      ].join(' ')}
                    >
                      <Icon aria-hidden size={13} strokeWidth={1.75} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className={['label-caps', fromApi ? 'text-accent' : 'text-fg-subtle'].join(' ')}>
                          {fromApi ? 'API' : 'REP'}
                        </span>
                        <span className="text-2xs font-semibold text-fg-muted">{meta.label}</span>
                        <span className="ml-auto shrink-0 text-2xs text-fg-subtle tnum">{formatDay(entry.at)}</span>
                      </div>
                      <div className="mt-0.5">
                        <EntryBody entry={entry} />
                        {entry.kind === 'note' && entry.author?.display_name && (
                          <span className="mt-0.5 block text-2xs text-fg-subtle">— {entry.author.display_name}</span>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ol>
            )}
          </Reference>
        )}

        <p className="px-1 pt-1 text-2xs text-fg-subtle">
          Source: <span className="font-medium text-fg-muted">{SOURCE_LABEL[detail.source]}</span>
        </p>
      </div>
    </div>
  )
}
