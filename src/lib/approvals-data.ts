import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { hubFetch } from './api'
import { AGENT_APPROVE_PATH } from './agent-chat'
import type { Role } from '../shell/ClientProvider'

// Manager Approvals (makes AT-32 usable end to end).
//
// The employee agent escalates a write a rep may not execute alone. hub-service
// records that as an `agent_events` row whose `result_summary.kind` is
// `approval_pending`; a manager clearing it produces a second row with kind
// `approved`. Both kinds ride in `result_summary` rather than in
// `approval_state` because that column has a CHECK constraint listing six
// states and widening it is a migration — hub-service's own note, and the
// reason this module queries a jsonb path instead of a column.
//
// THE SHAPE OF THE AUTHORITY, because it is easy to get backwards: the write
// runs in the PROPOSER's scope, never the approver's. A manager supplies
// authority, not reach. That is why `proposer_id` is sent on every approve —
// omitting it would make hub-service treat the call as the manager clearing
// their OWN checklist, which is a different (and wrong) code path.
//
// Reads are tenant-wide by RLS (`agent_events_select`) on purpose: an approval
// queue that only showed you your own rows could not be a queue.
const EVENT_LIMIT = 200

export const KIND_APPROVAL_PENDING = 'approval_pending'
export const KIND_APPROVED = 'approved'

/** Mirrors hub-service's `roleAtLeast` ladder for the UI only. hub-service
 *  re-derives it from the JWT on every request; this just avoids painting an
 *  Approve button that is guaranteed to come back 403. */
const RANK: Record<string, number> = { agent: 1, manager: 2, client_admin: 3, super_admin: 4 }

export function roleAtLeast(role: string | undefined, floor: string): boolean {
  return (RANK[role ?? ''] ?? 0) >= (RANK[floor] ?? 99)
}

/** hub-service's rule, mirrored: an approver may not sign for someone at or
 *  ABOVE their own level. The write would revalidate against the proposer's
 *  role, so the manager's signature would authorise an action they cannot
 *  perform themselves. */
export function canApproveFor(approver: Role | undefined, proposer: Role | undefined): boolean {
  if (!approver || !proposer) return false
  if (!roleAtLeast(approver, 'manager')) return false
  return (RANK[approver] ?? 0) >= (RANK[proposer] ?? 99)
}

export type PendingStep = {
  /** agent_events.id — the audit row, not the checklist step. */
  id: string
  sessionId: string
  runId: string
  proposerId: string
  /** The checklist item id hub-service expects back in `approvals[].id`. */
  step: string
  tool: string
  argsSummary: Record<string, unknown>
  createdAt: string
}

/** One session's outstanding proposals. Grouped because hub-service clears the
 *  WHOLE pending plan on a single call — anything not named in `approvals`
 *  comes back dismissed — so approving step-by-step would silently drop the
 *  steps the manager had not got to yet. */
export type ApprovalGroup = {
  sessionId: string
  runId: string
  proposerId: string
  steps: PendingStep[]
  createdAt: string
}

type EventRow = {
  id: string
  user_id: string
  session_id: string | null
  run_id: string
  tool: string
  args_summary: Record<string, unknown> | null
  result_summary: Record<string, unknown> | null
  created_at: string
}

function summaryString(row: EventRow, key: string): string | null {
  const v = row.result_summary?.[key]
  return typeof v === 'string' ? v : null
}

/** Still-pending = an `approval_pending` whose (run_id, step) has no `approved`
 *  row. There is no "cleared" flag to read: agent_events is append-only by
 *  design, so the answer is a subtraction, not a column. */
export function usePendingApprovals(clientId: string | null) {
  const [groups, setGroups] = useState<ApprovalGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!clientId) {
      setGroups([])
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error: err } = await supabase
      .from('agent_events')
      .select('id, user_id, session_id, run_id, tool, args_summary, result_summary, created_at')
      .eq('client_id', clientId)
      .in('result_summary->>kind', [KIND_APPROVAL_PENDING, KIND_APPROVED])
      .order('created_at', { ascending: false })
      .limit(EVENT_LIMIT)
    if (err) {
      setGroups([])
      setError(err.message)
      setLoading(false)
      return
    }
    setError(null)
    const rows = (data ?? []) as EventRow[]
    const cleared = new Set(
      rows
        .filter((r) => summaryString(r, 'kind') === KIND_APPROVED)
        .map((r) => `${r.run_id}::${summaryString(r, 'step') ?? ''}`),
    )

    const bySession = new Map<string, ApprovalGroup>()
    for (const r of [...rows].reverse()) {
      if (summaryString(r, 'kind') !== KIND_APPROVAL_PENDING) continue
      const step = summaryString(r, 'step')
      const sessionId = summaryString(r, 'session_id') ?? r.session_id
      const proposerId = summaryString(r, 'proposer_id') ?? r.user_id
      if (!step || !sessionId) continue
      if (cleared.has(`${r.run_id}::${step}`)) continue
      const key = `${sessionId}::${r.run_id}`
      const group = bySession.get(key) ?? {
        sessionId,
        runId: r.run_id,
        proposerId,
        steps: [],
        createdAt: r.created_at,
      }
      // A duplicate proposal for the same step (a retap) is one item, not two.
      if (!group.steps.some((s) => s.step === step)) {
        group.steps.push({
          id: r.id,
          sessionId,
          runId: r.run_id,
          proposerId,
          step,
          tool: r.tool,
          argsSummary: r.args_summary ?? {},
          createdAt: r.created_at,
        })
      }
      bySession.set(key, group)
    }
    setGroups([...bySession.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
    setLoading(false)
  }, [clientId])

  useEffect(() => {
    void load()
  }, [load])

  return { groups, loading, error, reload: load }
}

export type ApproveResult = { ok: true } | { ok: false; code: string }

/**
 * POST /api/agent-approve as the MANAGER, naming the proposer.
 *
 * `tier: 'explicit'` is what this screen renders, and hub-service treats it as
 * a claim rather than evidence — it recomputes the real tier from the tool
 * registry and the pending args, and answers `not_escalated` if the item never
 * needed a manager at all. Sending the claim honestly is the caller's whole
 * job here.
 *
 * Every outstanding step of the session goes in one call, because hub-service
 * dismisses anything absent from `approvals`.
 */
export async function approveGroup(
  clientId: string,
  group: ApprovalGroup,
): Promise<ApproveResult> {
  const res = await hubFetch<{ ok?: boolean; code?: string }>(AGENT_APPROVE_PATH, {
    method: 'POST',
    body: JSON.stringify({
      session_id: group.sessionId,
      client_id: clientId,
      proposer_id: group.proposerId,
      approvals: group.steps.map((s) => ({ id: s.step, tier: 'explicit' })),
    }),
  })
  if (res.kind !== 'ok') {
    // hub-service's refusal code, verbatim where it gave one — `self_approval`
    // and `not_escalated` are precise answers about authority and would lose
    // all their meaning as "something went wrong".
    return { ok: false, code: 'code' in res && res.code ? res.code : res.kind }
  }
  // 200 with ok:false is a PRODUCT outcome (stale checklist, wrong ceremony),
  // not a transport fault. Same convention as /api/agent-chat.
  if (res.data && res.data.ok === false) return { ok: false, code: res.data.code ?? 'refused' }
  return { ok: true }
}
