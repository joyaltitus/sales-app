import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

// Call loop data layer (WIRE-A2 part 4). Session start is a plain scoped
// upsert (client_id, client_request_id) is the idempotency key — a retried
// tap with the same key updates-in-place instead of forking a session, which
// is what makes the double-submit test meaningful. Outcome logging is the
// ONE compound write in this file: pm_log_call_outcome (migration 048) does
// the session-close + objection-log + follow_up + call_log insert atomically
// and is itself retry-safe (unique on call_session_id), so a network retry
// here returns the same result as the first call rather than a duplicate.
const CALL_LOG_LIMIT = 50
const PROFILE_LIMIT = 200

export type CallOutcome = 'closed' | 'progressing' | 'objection' | 'no_answer' | 'callback'

export type CallLogRow = {
  id: string
  call_session_id: string
  contact_id: string
  lead_id: string | null
  outcome: CallOutcome
  objection_log_id: string | null
  callback_follow_up_id: string | null
  note: string | null
  actor_id: string
  actorName: string | null
  occurred_at: string
}

export async function startCallSession({
  clientId,
  contactId,
  leadId,
  conversationId,
  actorId,
  surface,
  requestedNumber,
  clientRequestId,
}: {
  clientId: string
  contactId: string
  leadId?: string | null
  conversationId?: string | null
  actorId: string
  surface?: string | null
  requestedNumber?: string | null
  clientRequestId: string
}): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const { data, error } = await supabase
    .from('call_sessions')
    .upsert(
      {
        client_id: clientId,
        contact_id: contactId,
        lead_id: leadId ?? null,
        conversation_id: conversationId ?? null,
        actor_id: actorId,
        surface: surface ?? null,
        requested_number: requestedNumber ?? null,
        client_request_id: clientRequestId,
      },
      { onConflict: 'client_id,client_request_id' },
    )
    .select('id')
    .single()
  if (error) return { ok: false, message: error.message }
  return { ok: true, id: (data as { id: string }).id }
}

export async function completeCall(
  sessionId: string,
  outcome: CallOutcome,
  opts?: { taxonomyKey?: string | null; callbackAt?: string | null; note?: string | null },
): Promise<
  | {
      ok: true
      callLogId: string
      objectionLogId: string | null
      followUpId: string | null
      activeScriptVersionId: string | null
    }
  | { ok: false; message: string }
> {
  const { data, error } = await supabase.rpc('pm_log_call_outcome', {
    p_call_session_id: sessionId,
    p_outcome: outcome,
    p_taxonomy_key: opts?.taxonomyKey ?? null,
    p_callback_at: opts?.callbackAt ?? null,
    p_note: opts?.note ?? null,
  })
  if (error) return { ok: false, message: error.message }
  const row = (Array.isArray(data) ? data[0] : data) as
    | {
        call_log_id: string
        objection_log_id: string | null
        follow_up_id: string | null
        active_script_version_id: string | null
      }
    | undefined
  if (!row) return { ok: false, message: 'pm_log_call_outcome returned no row' }
  return {
    ok: true,
    callLogId: row.call_log_id,
    objectionLogId: row.objection_log_id,
    followUpId: row.follow_up_id,
    activeScriptVersionId: row.active_script_version_id,
  }
}

export function useCallLogs(clientId: string | null, contactId: string | null) {
  const [items, setItems] = useState<CallLogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!clientId || !contactId) {
      setItems([])
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const [logsRes, profilesRes] = await Promise.all([
      supabase
        .from('call_logs')
        .select(
          'id, call_session_id, contact_id, lead_id, outcome, objection_log_id, callback_follow_up_id, note, actor_id, occurred_at',
        )
        .eq('client_id', clientId)
        .eq('contact_id', contactId)
        .order('occurred_at', { ascending: false })
        .limit(CALL_LOG_LIMIT),
      supabase.from('profiles').select('user_id, display_name').eq('client_id', clientId).limit(PROFILE_LIMIT),
    ])
    if (logsRes.error) {
      setItems([])
      setError(logsRes.error.message)
      setLoading(false)
      return
    }
    setError(null)
    const nameByUser = new Map(
      ((profilesRes.data ?? []) as { user_id: string; display_name: string }[]).map((p) => [p.user_id, p.display_name]),
    )
    setItems(
      ((logsRes.data ?? []) as Omit<CallLogRow, 'actorName'>[]).map((row) => ({
        ...row,
        actorName: nameByUser.get(row.actor_id) ?? null,
      })),
    )
    setLoading(false)
  }, [clientId, contactId])

  useEffect(() => {
    void load()
  }, [load])

  return { items, loading, error, reload: load }
}
