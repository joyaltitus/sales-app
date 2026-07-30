import { useMemo } from 'react'
import type { LeadItem, LeadStage, FollowUpItem } from '../../lib/leads-data'
import { leadTemperature } from '../../lib/temperature'
import type { Temperature } from '../../lib/temperature'
import { Avatar } from '../../ui/Avatar'
import { ChannelIcon } from '../../ui/ChannelIcon'
import { inrCompact } from './PipelineStrip'
import { waitStamp } from '../../lib/wait'
import { Flame, Sun, Snowflake, Pin } from 'lucide-react'

// SA-05 pipeline board — the Workbench kanban rebuilt in the Board language:
// desktop-only (≥lg; phones keep the row list — a 4-column board at 390px is
// a toy), stages as columns, cards lead with the PERSON. No drag-and-drop
// library (§1.10 #17 spirit): the stage move lives in the drawer and on the
// row list's select, both RLS-gated server-side.

const capsStyle = {
  fontWeight: 'var(--weight-caps)',
  letterSpacing: 'var(--tracking-caps)',
} as const

const monoStyle = { fontFamily: 'var(--font-mono)' } as const

export const TEMP_META: Record<
  Temperature,
  { label: string; icon: typeof Flame; cls: string }
> = {
  hot: { label: 'Hot', icon: Flame, cls: 'text-warn' },
  warm: { label: 'Warm', icon: Sun, cls: 'text-fg-muted' },
  cold: { label: 'Cold', icon: Snowflake, cls: 'text-fg-subtle' },
}

export function TempBadge({ temp, overridden }: { temp: Temperature; overridden: boolean }) {
  const meta = TEMP_META[temp]
  const Icon = meta.icon
  return (
    <span
      className={['flex shrink-0 items-center gap-1 text-2xs uppercase', meta.cls].join(' ')}
      style={capsStyle}
      title={overridden ? `${meta.label} (set by hand)` : meta.label}
    >
      <Icon aria-hidden size={12} strokeWidth={1.75} />
      {meta.label}
      {overridden && <Pin aria-hidden size={10} strokeWidth={1.75} />}
    </span>
  )
}

export function BoardView({
  stages,
  items,
  followUpByLead,
  selectedId,
  onSelect,
  now,
}: {
  stages: LeadStage[]
  items: LeadItem[]
  followUpByLead: Map<string, FollowUpItem>
  selectedId: string | null
  onSelect: (lead: LeadItem) => void
  now: number
}) {
  const byStage = useMemo(() => {
    const m = new Map<string, LeadItem[]>()
    for (const s of stages) m.set(s.id, [])
    for (const l of items) m.get(l.stage_id)?.push(l)
    return m
  }, [stages, items])

  return (
    <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto p-3">
      {stages.map((stage) => {
        const leads = byStage.get(stage.id) ?? []
        const value = leads
          .filter((l) => l.status !== 'lost')
          .reduce((a, l) => a + Number(l.est_value ?? 0), 0)
        return (
          <section
            key={stage.id}
            className="flex w-64 shrink-0 flex-col rounded-md border border-border bg-surface-sunk"
            aria-label={`${stage.label}, ${leads.length} leads`}
          >
            <header className="flex items-baseline gap-2 px-3 pt-2.5 pb-2">
              <h3 className="truncate text-2xs text-fg-muted uppercase" style={capsStyle}>
                {stage.label}
              </h3>
              <span className="tnum text-xs text-fg-subtle" style={monoStyle}>
                {leads.length}
              </span>
              {value > 0 && (
                <span className="tnum ml-auto text-2xs text-fg-subtle" style={monoStyle}>
                  ₹{inrCompact(value)}
                </span>
              )}
            </header>
            <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-1.5 pb-1.5">
              {leads.length === 0 ? (
                <p className="px-2 py-4 text-center text-2xs text-fg-subtle">Nothing here.</p>
              ) : (
                leads.map((lead) => {
                  const name =
                    lead.contact?.profile_name ?? lead.contact?.external_id ?? 'Unknown contact'
                  const { temp, overridden } = leadTemperature(
                    lead,
                    stages,
                    false,
                    lead.conversation?.last_customer_message_at ?? null,
                    now,
                  )
                  const fu = followUpByLead.get(lead.id)
                  const fuOverdue = fu && new Date(fu.due_at).getTime() < now
                  return (
                    <button
                      key={lead.id}
                      onClick={() => onSelect(lead)}
                      aria-current={selectedId === lead.id ? 'true' : undefined}
                      className={[
                        'block w-full rounded-md border p-2.5 text-left transition-colors',
                        selectedId === lead.id
                          ? 'border-accent bg-surface'
                          : 'border-border bg-surface hover:border-border-strong',
                      ].join(' ')}
                    >
                      <div className="flex items-center gap-2">
                        <Avatar name={name} profile={null} size="sm" />
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">
                          {name}
                        </span>
                        <ChannelIcon channel={lead.contact?.channel ?? null} size={13} />
                      </div>
                      <div className="mt-1.5 flex items-center gap-2.5">
                        <TempBadge temp={temp} overridden={overridden} />
                        {lead.est_value != null && (
                          <span className="tnum text-2xs text-fg-subtle" style={monoStyle}>
                            ₹{inrCompact(Number(lead.est_value))}
                          </span>
                        )}
                        <span className="tnum ml-auto text-2xs text-fg-subtle" style={monoStyle}>
                          {waitStamp(
                            lead.conversation?.last_customer_message_at ?? lead.updated_at,
                          )}
                        </span>
                      </div>
                      {(fu || (lead.status !== 'open' && lead.status)) && (
                        <div className="mt-1.5 flex items-center gap-2.5">
                          {lead.status !== 'open' && (
                            <span
                              className={[
                                'text-2xs uppercase',
                                lead.status === 'won' ? 'text-success' : 'text-danger',
                              ].join(' ')}
                              style={capsStyle}
                            >
                              {lead.status}
                            </span>
                          )}
                          {fu && (
                            <span
                              className={[
                                'truncate text-2xs uppercase',
                                fuOverdue ? 'text-danger' : 'text-fg-subtle',
                              ].join(' ')}
                              style={capsStyle}
                            >
                              {fuOverdue ? 'Follow-up overdue' : 'Follow-up set'}
                            </span>
                          )}
                        </div>
                      )}
                    </button>
                  )
                })
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}
