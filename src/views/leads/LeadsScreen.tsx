import { useCallback, useMemo, useState } from 'react'
import { useClient } from '../../shell/ClientProvider'
import { useAuth } from '../../auth/AuthProvider'
import { useLeads, useLeadStages, useFollowUps, moveLeadStage } from '../../lib/leads-data'
import type { LeadItem } from '../../lib/leads-data'
import { EmptyState } from '../../ui/EmptyState'
import { Skeleton } from '../../ui/Skeleton'
import { LeadRow } from './LeadRow'

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
export function LeadsScreen() {
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

  const stageById = useMemo(() => new Map(stages.map((s) => [s.id, s])), [stages])

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
          title="Nothing waiting."
          body="Share your WhatsApp link to start capturing leads."
        />
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        {items.map((lead) => {
          const displayLead = optimistic.has(lead.id)
            ? { ...lead, stage_id: optimistic.get(lead.id)! }
            : lead
          return (
            <div key={lead.id}>
              <LeadRow
                lead={displayLead}
                stage={stageById.get(displayLead.stage_id) ?? null}
                stages={stages}
                followUp={followUpByLead.get(lead.id)}
                canEditStage={canEditStage(lead) && !pending.has(lead.id)}
                onStageChange={(stageId) => void handleStageChange(lead, stageId)}
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
  )
}
