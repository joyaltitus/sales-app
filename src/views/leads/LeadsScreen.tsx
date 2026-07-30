import { useCallback, useMemo, useState } from 'react'
import { Search, Kanban, Download } from 'lucide-react'
import { useClient } from '../../shell/ClientProvider'
import { useAuth } from '../../auth/AuthProvider'
import { useLeads, useLeadStages, useFollowUps, moveLeadStage } from '../../lib/leads-data'
import type { LeadItem } from '../../lib/leads-data'
import { downloadCsv } from '../../lib/crm-data'
import { leadTemperature } from '../../lib/temperature'
import { EmptyState } from '../../ui/EmptyState'
import { Skeleton } from '../../ui/Skeleton'
import { Sheet } from '../../ui/Sheet'
import { LeadRow } from './LeadRow'
import { PipelineStrip } from '../crm/PipelineStrip'
import { BoardView } from '../crm/BoardView'
import { LeadDrawer } from '../crm/LeadDrawer'

// ONE Leads implementation, mounted by both RepShell and ManagerShell — same
// pattern as InboxScreen (amendment item 1). The difference between the two
// is not a layout fork: it is which rows carry an interactive stage control,
// decided per-row from real membership/assignment data, never a role check
// on the whole screen.
//
// ⚠ ROLE-WALL NOTE (§2): `canEditStage` below is a RENDERING decision only.
// It grants nothing and withholds nothing — the actual wall is the `leads`
// RLS policies (migration 035), proved empirically before this screen was
// built: a manager's write always lands, an agent's write lands only when
// `conversations.assigned_to` is them, and Postgres silently drops any other
// attempt. Flipping this prop in devtools changes which control is painted
// and nothing else.
// SA-04: the CRM Pipeline tab mounts this same screen with `crm` — which adds
// the pipeline value strip, search, a click-to-filter stage, and the SAMPLE
// assignment/objection controls per row. The rep board mounts it bare and is
// unchanged. One implementation, not a fork (same law as InboxScreen).
export function LeadsScreen({ crm = false }: { crm?: boolean }) {
  const { activeClient } = useClient()
  const { session } = useAuth()
  const clientId = activeClient?.id ?? null
  const userId = session?.user?.id ?? null
  const role = activeClient?.role ?? null

  const { items, loading, error, reload } = useLeads(clientId)
  const { stages, loading: stagesLoading } = useLeadStages(clientId)
  const { items: followUps } = useFollowUps(clientId)

  const [pending, setPending] = useState<Set<string>>(new Set())
  const [optimistic, setOptimistic] = useState<Map<string, string>>(new Map())
  const [failedId, setFailedId] = useState<string | null>(null)

  // CRM-only working state. Filtering is client-side over the already-fetched
  // bounded list (300 rows) — zero backend change, same as the Inbox filters.
  const [query, setQuery] = useState('')
  const [stageFilter, setStageFilter] = useState<string | null>(null)
  const [tempFilter, setTempFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selected, setSelected] = useState<LeadItem | null>(null)

  const stageById = useMemo(() => new Map(stages.map((s) => [s.id, s])), [stages])
  const now = Date.now()

  // SA-05 rep scope (Joyal's ruling 2026-07-30: employees get the CRM, seeing
  // their own + unassigned leads; manager/admin see the tenant). RENDERING
  // scope only — `leads` SELECT is tenant-wide under RLS for every role, and
  // the WRITE wall stays migration 035. Hiding a row grants nothing.
  const scopedItems = useMemo(() => {
    if (!crm || role !== 'agent') return items
    return items.filter(
      (l) => l.conversation?.assigned_to == null || l.conversation.assigned_to === userId,
    )
  }, [crm, role, items, userId])

  const visibleItems = useMemo(() => {
    if (!crm) return scopedItems
    const q = query.trim().toLowerCase()
    return scopedItems.filter((lead) => {
      if (stageFilter && lead.stage_id !== stageFilter) return false
      if (statusFilter && lead.status !== statusFilter) return false
      if (tempFilter) {
        const { temp } = leadTemperature(
          lead,
          stages,
          false,
          lead.conversation?.last_customer_message_at ?? null,
          now,
        )
        if (temp !== tempFilter) return false
      }
      if (!q) return true
      const hay = [
        lead.contact?.profile_name,
        lead.contact?.external_id,
        lead.objection,
        lead.next_action,
        lead.lost_reason,
      ]
      return hay.some((v) => v?.toLowerCase().includes(q))
    })
  }, [crm, scopedItems, query, stageFilter, statusFilter, tempFilter, stages, now])

  const exportCsv = useCallback(() => {
    downloadCsv(
      `leads-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Name', 'Phone / handle', 'Channel', 'Stage', 'Status', 'Temperature', 'Est. value', 'Objection', 'Last activity'],
      visibleItems.map((l) => {
        const { temp } = leadTemperature(
          l,
          stages,
          false,
          l.conversation?.last_customer_message_at ?? null,
          now,
        )
        return [
          l.contact?.profile_name ?? '',
          l.contact?.external_id ?? '',
          l.contact?.channel ?? '',
          stageById.get(l.stage_id)?.label ?? '',
          l.status,
          temp,
          l.est_value,
          l.objection,
          l.conversation?.last_customer_message_at ?? '',
        ]
      }),
    )
  }, [visibleItems, stages, stageById, now])

  // Earliest pending/snoozed follow-up per lead — the rest are quieter than
  // the board has room for (§1.10's bounded-lists rule applies here too).
  const followUpByLead = useMemo(() => {
    const m = new Map<string, (typeof followUps)[number]>()
    for (const f of followUps) {
      if (!f.lead_id) continue
      if (!m.has(f.lead_id)) m.set(f.lead_id, f)
    }
    return m
  }, [followUps])

  const canEditStage = useCallback(
    (lead: LeadItem) => {
      if (role === 'manager' || role === 'client_admin') return true
      if (role === 'agent') return lead.conversation?.assigned_to === userId
      return false
    },
    [role, userId],
  )

  const handleStageChange = useCallback(
    async (lead: LeadItem, stageId: string) => {
      if (!clientId || stageId === lead.stage_id) return
      const prevStageId = lead.stage_id
      setFailedId(null)
      setOptimistic((m) => new Map(m).set(lead.id, stageId))
      setPending((s) => new Set(s).add(lead.id))

      const result = await moveLeadStage(clientId, lead.id, stageId)

      setPending((s) => {
        const next = new Set(s)
        next.delete(lead.id)
        return next
      })

      if (result.ok) {
        void reload()
        return
      }

      // Denied (RLS silently filtered) or a genuine error — either way the
      // optimistic paint was wrong, so revert it rather than leave the UI
      // claiming a move that never happened.
      setOptimistic((m) => {
        const next = new Map(m)
        next.set(lead.id, prevStageId)
        return next
      })
      setFailedId(lead.id)
    },
    [clientId, reload],
  )

  if (loading || stagesLoading) {
    return (
      <div className="space-y-2 p-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <EmptyState title="Couldn't load leads" body="Check your connection and try again." />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Kanban}
          title="Nothing waiting."
          body="Share your WhatsApp link to start capturing leads."
        />
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {crm && (
        <div className="shrink-0 space-y-2 border-b border-border bg-surface px-3 pt-2.5 pb-2">
          <PipelineStrip
            stages={stages}
            items={scopedItems}
            activeStageId={stageFilter}
            onStageClick={(id) => setStageFilter((cur) => (cur === id ? null : id))}
          />
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search
                aria-hidden
                size={14}
                strokeWidth={1.75}
                className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-fg-subtle"
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, number, objection"
                aria-label="Search leads"
                className="h-8 w-full max-w-sm rounded-md border border-border bg-surface pr-2 pl-8 text-xs text-fg transition-colors placeholder:text-fg-subtle hover:border-border-strong"
              />
            </div>
            <select
              value={tempFilter}
              onChange={(e) => setTempFilter(e.target.value)}
              aria-label="Temperature filter"
              className="h-8 shrink-0 rounded-md border border-border bg-surface px-2 text-xs text-fg-muted hover:border-border-strong"
            >
              <option value="">All temps</option>
              <option value="hot">Hot</option>
              <option value="warm">Warm</option>
              <option value="cold">Cold</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Status filter"
              className="h-8 shrink-0 rounded-md border border-border bg-surface px-2 text-xs text-fg-muted hover:border-border-strong"
            >
              <option value="">All statuses</option>
              <option value="open">Open</option>
              <option value="won">Won</option>
              <option value="lost">Lost</option>
            </select>
            <button
              onClick={exportCsv}
              className="flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 text-xs font-medium text-fg-muted hover:border-border-strong hover:text-fg"
            >
              <Download aria-hidden size={13} strokeWidth={1.75} />
              Export
            </button>
          </div>
        </div>
      )}

      {/* Desktop CRM: the kanban board. */}
      {crm && (
        <div className="hidden min-h-0 flex-1 lg:flex">
          <BoardView
            stages={stages}
            items={visibleItems}
            followUpByLead={followUpByLead}
            selectedId={selected?.id ?? null}
            onSelect={(lead) => setSelected((cur) => (cur?.id === lead.id ? null : lead))}
            now={now}
          />
        </div>
      )}

      {/* Row list: the whole story below lg; phone-first, same rows as SA-02. */}
      <div className={['min-h-0 flex-1 overflow-y-auto', crm ? 'lg:hidden' : ''].join(' ')}>
        {crm && visibleItems.length === 0 && (
          <div className="p-6">
            <EmptyState
              title="No matches."
              body="Nothing fits these filters. Clear the search or tap the stage again."
            />
          </div>
        )}
        {visibleItems.map((lead) => {
          const displayLead = optimistic.has(lead.id)
            ? { ...lead, stage_id: optimistic.get(lead.id)! }
            : lead
          return (
            <div
              key={lead.id}
              onClick={crm ? () => setSelected(lead) : undefined}
              className={crm ? 'cursor-pointer' : undefined}
            >
              <LeadRow
                lead={displayLead}
                stage={stageById.get(displayLead.stage_id) ?? null}
                stages={stages}
                followUp={followUpByLead.get(lead.id)}
                canEditStage={canEditStage(lead) && !pending.has(lead.id)}
                onStageChange={(stageId) => void handleStageChange(lead, stageId)}
                crm={crm}
              />
              {failedId === lead.id && (
                <div className="border-b border-border bg-surface px-4 py-1.5 text-2xs text-danger">
                  That stage move didn't go through. You may not have permission on this lead.
                </div>
              )}
            </div>
          )
        })}
      </div>
      </div>

      {/* Lead drawer — inline panel at lg+, sheet below (§1.10 #12). */}
      {crm && selected && clientId && (
        <div className="hidden w-96 shrink-0 border-l border-border bg-surface lg:block">
          <LeadDrawer
            clientId={clientId}
            lead={selected}
            stages={stages}
            onClose={() => setSelected(null)}
            onSaved={() => void reload()}
          />
        </div>
      )}
      {crm && clientId && (
        <div className="lg:hidden">
          <Sheet open={!!selected} onClose={() => setSelected(null)} title="Lead">
            {selected && (
              <LeadDrawer
                clientId={clientId}
                lead={selected}
                stages={stages}
                onClose={() => setSelected(null)}
                onSaved={() => void reload()}
              />
            )}
          </Sheet>
        </div>
      )}
    </div>
  )
}
