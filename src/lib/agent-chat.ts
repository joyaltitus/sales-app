import { useEffect, useState } from 'react'
import { hubFetch, type HubResult } from './api'
import { supabase } from './supabase'

// B-UI (SA-AGENT-03) — hub-service agent-chat client. Hand-copied response shape (no shared
// package between the two repos — same convention as api.ts's `Insight` type and
// metrics-data.ts's point types). Source of truth: hub-service src/agent/run.ts,
// src/agent/checklist.ts, src/api/agent-chat.ts, src/api/agent-approve.ts.
export const AGENT_CHAT_PATH = '/api/agent-chat'
export const AGENT_APPROVE_PATH = '/api/agent-approve'

export type ApprovalTier = 'auto' | 'one_tap' | 'explicit'
export type ChecklistStatus = 'proposed' | 'confirmed' | 'executed' | 'failed' | 'blocked' | 'dismissed'

export type StepOutcome = {
  id: string
  tool: string
  status: 'executed' | 'failed' | 'blocked'
  rows?: Record<string, unknown>[]
  truncated?: boolean
  error?: string
}

export type ChecklistItem = {
  id: string
  tool: string
  tier: ApprovalTier
  summary: Record<string, unknown>
  dependsOn: string[]
  status: ChecklistStatus
  ref?: string | null
  error?: string
}

export type Capability = { tool: string; description: string; args: string[] }

export type AgentChatOk = {
  ok: true
  reply: string
  source: 'intent' | 'model'
  steps: StepOutcome[]
  checklist: ChecklistItem[]
  session_id: string
  session_closed: boolean | null
  session_closed_reason: string | null
  model_calls: number
}

export type AgentChatFallback = {
  ok: false
  code: 'plan_rejected' | 'unparseable_plan'
  reason?: string
  capabilities: Capability[]
}

/** POST /api/agent-chat — the employee agent lane's only entrance. */
export function sendAgentChat(input: {
  text: string
  sessionId: string | null
  clientId: string | null
  anchorContactId: string | null
  anchorLeadId: string | null
}): Promise<HubResult<AgentChatOk | AgentChatFallback>> {
  return hubFetch<AgentChatOk | AgentChatFallback>(AGENT_CHAT_PATH, {
    method: 'POST',
    body: JSON.stringify({
      text: input.text,
      client_id: input.clientId,
      session_id: input.sessionId,
      anchor_contact_id: input.anchorContactId,
      anchor_lead_id: input.anchorLeadId,
    }),
  })
}

export type Approval = {
  id: string
  tier: Exclude<ApprovalTier, 'auto'>
  edits?: Partial<Record<'value' | 'note', string>>
}

export type AgentApproveOk = { ok: true; session_id: string; items: ChecklistItem[] }
export type AgentApproveFallback = {
  ok: false
  code: 'no_pending_plan' | 'unknown_item' | 'tier_mismatch'
  reason?: string | null
  items: ChecklistItem[]
}

/** POST /api/agent-approve — a separate request; the chat turn proposes, this one disposes.
 *  hub-service clears the WHOLE pending plan on this one call — anything not named in
 *  `approvals` comes back dismissed, so this must be called once with every decision. */
export function approveChecklist(
  sessionId: string,
  clientId: string | null,
  approvals: Approval[],
): Promise<HubResult<AgentApproveOk | AgentApproveFallback>> {
  return hubFetch<AgentApproveOk | AgentApproveFallback>(AGENT_APPROVE_PATH, {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId, client_id: clientId, approvals }),
  })
}

export type AgentActivityRow = {
  id: string
  tool: string
  result_summary: Record<string, unknown> | null
  created_at: string
}

const ACTIVITY_LIMIT = 10

/** Direct RLS read, own-tenant only (B-UI premise) — same convention as crm-data.ts. */
export function useAgentActivity(): { rows: AgentActivityRow[]; loading: boolean } {
  const [rows, setRows] = useState<AgentActivityRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void supabase
      .from('agent_events')
      .select('id, tool, result_summary, created_at')
      .neq('tool', 'plan')
      .order('created_at', { ascending: false })
      .limit(ACTIVITY_LIMIT)
      .then(({ data }) => {
        if (cancelled) return
        setRows((data ?? []) as AgentActivityRow[])
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { rows, loading }
}
