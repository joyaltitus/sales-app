import type { LeadDetail, TimelineEntry } from '../lib/contracts'
import { ArrowDownLeft, ArrowLeft, ArrowUpRight, Check, MessageSquare, Phone, ShieldAlert, StickyNote } from 'lucide-react'
import { Avatar } from '../../src/ui/Avatar'
import { Button } from '../../src/ui/Button'
import { ChannelIcon } from '../../src/ui/ChannelIcon'
import { Chip } from '../../src/ui/Chip'
import { EmptyState } from '../../src/ui/EmptyState'
import { formatDay } from './time'

type Props = {
  detail: LeadDetail
  /** When set and different from lead.owner.user_id, renders the quiet "Owned by" line. */
  viewerId?: string
  onBack?: () => void
  onOpenChat?: () => void
  onCall?: () => void
}

const SOURCE_LABEL = { api: 'AI transcript', rep: 'Rep declared', both: 'AI + rep' } as const

const KIND_META: Record<TimelineEntry['kind'], { icon: typeof MessageSquare; label: string }> = {
  message: { icon: MessageSquare, label: 'Message' },
  call_log: { icon: Phone, label: 'Call' },
  note: { icon: StickyNote, label: 'Note' },
  objection: { icon: ShieldAlert, label: 'Objection' },
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

export function LeadScreen({ detail, viewerId, onBack, onOpenChat, onCall }: Props) {
  const { lead, facts, objections, timeline } = detail
  const ownedByOther = lead.owner != null && lead.owner.user_id !== viewerId

  return (
    <div>
      <header className="sticky top-0 z-10 border-b border-border bg-surface px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back to queue" className="-ml-2">
              <ArrowLeft aria-hidden size={18} strokeWidth={1.75} />
            </Button>
          )}
          <Avatar name={lead.display_name} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h2 className="truncate text-md font-semibold tracking-[-0.015em] text-fg">{lead.display_name}</h2>
              <ChannelIcon channel={lead.channel === 'phone' ? null : lead.channel} />
            </div>
            <div className="mt-0.5 flex items-center gap-1.5">
              <span className="truncate text-2xs text-fg-subtle">{lead.stage_label}</span>
              <Chip tone={lead.status === 'open' ? 'neutral' : lead.status === 'won' ? 'success' : 'danger'}>
                {lead.status}
              </Chip>
              <Chip tone="accent">{SOURCE_LABEL[detail.source]}</Chip>
            </div>
          </div>
        </div>
        {ownedByOther && (
          <p className="mt-1 text-2xs text-fg-subtle">Owned by {lead.owner?.display_name ?? 'another rep'}</p>
        )}
      </header>

      <div className="space-y-4 px-3 py-3">
        <section aria-label="Contact actions" className="flex gap-2">
          {lead.phone_e164 ? (
            <>
              <Button className="min-h-10 flex-1" onClick={onOpenChat}>
                Open chat
              </Button>
              <Button variant="secondary" className="min-h-10 flex-1" onClick={onCall}>
                {lead.phone_e164}
              </Button>
            </>
          ) : (
            <p className="w-full rounded-md border border-border bg-surface-sunk px-3 py-2.5 text-xs text-fg-subtle">
              No phone number captured for this lead.
            </p>
          )}
        </section>

        {facts.length > 0 && (
          <section aria-label="Facts">
            <h3 className="label-caps mb-1.5">Facts</h3>
            <ul className="overflow-hidden rounded-lg border border-border bg-surface-raised">
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
          </section>
        )}

        {objections.length > 0 && (
          <section aria-label="Objections">
            <h3 className="label-caps mb-1.5">Objections raised</h3>
            <ul className="space-y-1.5">
              {objections.map((objection) => (
                <li key={objection.id} className="flex items-center gap-2 text-xs">
                  <ShieldAlert aria-hidden size={13} className="shrink-0 text-danger" />
                  <span className="font-medium text-fg">{objection.label}</span>
                  <span className="ml-auto shrink-0 text-2xs text-fg-subtle tnum">{formatDay(objection.occurred_at)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-label="History">
          <h3 className="label-caps mb-1.5">History</h3>
          {timeline.length === 0 ? (
            <EmptyState title="No history yet" body="Declared calls and the AI transcript land here." />
          ) : (
            <ol className="space-y-2.5">
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
                        <span
                          className={[
                            'label-caps',
                            fromApi ? 'text-accent' : 'text-fg-subtle',
                          ].join(' ')}
                        >
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
        </section>
      </div>
    </div>
  )
}
