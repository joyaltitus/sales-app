import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

// Objection capture + history data layer (WIRE-A2 / MOAT-WIRE-01 part 1).
// Mirrors leads-data.ts / todos-data.ts conventions: plain PostgREST reads
// (+ scoped writes), no RPCs here — the call-outcome path's objection insert
// goes through pm_log_call_outcome instead (calls-data.ts), never this file.
//
// objection_logs.taxonomy_id carries a real FK to objection_taxonomy, so that
// embed resolves via PostgREST. objection_logs.actor_id carries NO FK to
// profiles (migration 048, same posture as employee_todos.assignee) — actor
// names are joined client-side, same pattern as todos-data.ts useProfiles.
const TAXONOMY_LIMIT = 50
const LOG_LIMIT = 50
const PROFILE_LIMIT = 200

export type ObjectionSource = 'chat' | 'crm' | 'call'

export type ObjectionTaxonomyRow = {
  id: string
  key: string
  label: string
  aliases: string[]
}

export type ObjectionLogRow = {
  id: string
  contact_id: string
  conversation_id: string | null
  lead_id: string | null
  taxonomy_id: string
  taxonomyKey: string
  taxonomyLabel: string
  source: ObjectionSource
  note: string | null
  actor_id: string
  actorName: string | null
  occurred_at: string
  resolved: boolean
}

function oneOf<T>(v: T | T[] | null): T | null {
  if (!v) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

export function useObjectionTaxonomy(clientId: string | null) {
  const [items, setItems] = useState<ObjectionTaxonomyRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!clientId) {
      setItems([])
      setLoading(false)
      return
    }
    setLoading(true)
    supabase
      .from('objection_taxonomy')
      .select('id, key, label, aliases')
      .eq('client_id', clientId)
      .eq('status', 'active')
      .order('label', { ascending: true })
      .limit(TAXONOMY_LIMIT)
      .then(({ data }) => {
        setItems((data ?? []) as ObjectionTaxonomyRow[])
        setLoading(false)
      })
  }, [clientId])

  return { items, loading }
}

export function useObjectionLogs(clientId: string | null, contactId: string | null) {
  const [items, setItems] = useState<ObjectionLogRow[]>([])
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
        .from('objection_logs')
        .select(
          'id, contact_id, conversation_id, lead_id, taxonomy_id, source, note, actor_id, occurred_at, resolved_at, objection_taxonomy ( key, label )',
        )
        .eq('client_id', clientId)
        .eq('contact_id', contactId)
        .is('undone_at', null)
        .order('occurred_at', { ascending: false })
        .limit(LOG_LIMIT),
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
      (logsRes.data ?? []).map((r) => {
        const row = r as unknown as {
          id: string
          contact_id: string
          conversation_id: string | null
          lead_id: string | null
          taxonomy_id: string
          source: ObjectionSource
          note: string | null
          actor_id: string
          occurred_at: string
          resolved_at: string | null
          objection_taxonomy: { key: string; label: string } | { key: string; label: string }[] | null
        }
        const tax = oneOf(row.objection_taxonomy)
        return {
          id: row.id,
          contact_id: row.contact_id,
          conversation_id: row.conversation_id,
          lead_id: row.lead_id,
          taxonomy_id: row.taxonomy_id,
          taxonomyKey: tax?.key ?? 'custom',
          taxonomyLabel: tax?.label ?? 'Custom',
          source: row.source,
          note: row.note,
          actor_id: row.actor_id,
          actorName: nameByUser.get(row.actor_id) ?? null,
          occurred_at: row.occurred_at,
          resolved: !!row.resolved_at,
        }
      }),
    )
    setLoading(false)
  }, [clientId, contactId])

  useEffect(() => {
    void load()
  }, [load])

  return { items, loading, error, reload: load }
}

/** Insert a chat/crm-source objection log. (Call-source objections go through
 *  pm_log_call_outcome — calls-data.ts — never this function.) */
export async function logObjection({
  clientId,
  contactId,
  conversationId,
  leadId,
  taxonomyId,
  source,
  note,
  actorId,
  id,
}: {
  clientId: string
  contactId: string
  conversationId?: string | null
  leadId?: string | null
  taxonomyId: string
  source: ObjectionSource
  note?: string | null
  actorId: string
  id?: string
}): Promise<{ ok: true; id: string } | { ok: false; message: string; code?: string }> {
  const { data, error } = await supabase
    .from('objection_logs')
    .insert({
      id,
      client_id: clientId,
      contact_id: contactId,
      conversation_id: conversationId ?? null,
      lead_id: leadId ?? null,
      taxonomy_id: taxonomyId,
      source,
      note: note ?? null,
      actor_id: actorId,
    })
    .select('id')
    .single()
  if (error) return { ok: false, message: error.message, ...(error.code ? { code: error.code } : {}) }
  return { ok: true, id: (data as { id: string }).id }
}

/** Undo a log — sets undone_at/undone_by, never deletes (the audit survives). */
export async function undoObjection(
  clientId: string,
  id: string,
  undoneBy: string,
): Promise<{ ok: true } | { ok: false; reason: 'denied' | 'error'; message?: string }> {
  const { data, error } = await supabase
    .from('objection_logs')
    .update({ undone_at: new Date().toISOString(), undone_by: undoneBy })
    .eq('client_id', clientId)
    .eq('id', id)
    .select('id')
  if (error) return { ok: false, reason: 'error', message: error.message }
  if (!data || data.length === 0) return { ok: false, reason: 'denied' }
  return { ok: true }
}

export async function saveNote(
  clientId: string,
  id: string,
  note: string,
): Promise<{ ok: true } | { ok: false; reason: 'denied' | 'error'; message?: string }> {
  const { data, error } = await supabase
    .from('objection_logs')
    .update({ note })
    .eq('client_id', clientId)
    .eq('id', id)
    .select('id')
  if (error) return { ok: false, reason: 'error', message: error.message }
  if (!data || data.length === 0) return { ok: false, reason: 'denied' }
  return { ok: true }
}
