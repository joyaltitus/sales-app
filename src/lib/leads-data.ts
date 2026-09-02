import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

// Leads data layer. Plain PostgREST table reads (+ one scoped UPDATE), no RPCs,
// no views, no edge functions — same shape as inbox-data.ts.
//
// Every read filters .eq('client_id', clientId) EXPLICITLY *and* sits under
// RLS. No realtime here (direction §S4 CONTEXT: "No realtime — refetch on
// write"), so callers refetch after a successful stage move instead of
// subscribing.
const LEAD_LIMIT = 300
const STAGE_LIMIT = 20
const FOLLOW_UP_LIMIT = 300

export type LeadStage = {
  id: string
  stage_key: string
  label: string
  sort_order: number
  is_won: boolean
}

export type LeadItem = {
  id: string
  contact_id: string
  conversation_id: string | null
  stage_id: string
  status: string
  est_value: number | null
  temperature_override: string | null
  next_action: string | null
  objection: string | null
  lost_reason: string | null
  updated_at: string
  // AT-33: the two columns rep_queue_v resolves an owner from, alongside
  // conversations.assigned_to. Read here so the rep scope can use the SAME
  // definition of "mine" the view (and the extension) already use, rather than
  // a second, narrower one that loses a rep their own manually-created leads.
  owner_id: string | null
  created_by: string | null
  contact: { profile_name: string | null; channel: string; external_id: string } | null
  // SA-05: `last_customer_message_at` joined for temperature derivation (the
  // Workbench definition of lastActivityAt) — one read shape, not a second
  // conversation query (same law as inbox-data's SA-03 note).
  conversation: { assigned_to: string | null; last_customer_message_at: string | null } | null
}

export type FollowUpItem = {
  id: string
  lead_id: string | null
  contact_id: string
  due_at: string
  status: string
  note: string
  source_call_id: string | null
}

export type DueFollowUp = Pick<FollowUpItem, 'id' | 'note' | 'due_at'>

/** Bounded worker read for the next alarm window, explicitly tenant-scoped. */
export async function readDueFollowUps(clientIds: string[], through: string): Promise<DueFollowUp[]> {
  if (clientIds.length === 0) return []
  const { data, error } = await supabase
    .from('follow_ups')
    .select('id, note, due_at')
    .in('client_id', clientIds)
    .in('status', ['pending', 'snoozed'])
    .lte('due_at', through)
    .order('due_at', { ascending: true })
    .limit(FOLLOW_UP_LIMIT)
  if (error) throw error
  return (data ?? []) as DueFollowUp[]
}

/** Supabase infers a to-one embed as an array; at runtime it is the single
 *  joined row. Normalize either shape (the same trap inbox-data.ts hit). */
function oneOf<T>(v: T | T[] | null): T | null {
  if (!v) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

export function useLeadStages(clientId: string | null) {
  const [stages, setStages] = useState<LeadStage[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!clientId) {
      setStages([])
      setLoading(false)
      return
    }
    setLoading(true)
    supabase
      .from('lead_stages')
      .select('id, stage_key, label, sort_order, is_won')
      .eq('client_id', clientId)
      .eq('active', true)
      .order('sort_order', { ascending: true })
      .limit(STAGE_LIMIT)
      .then(({ data }) => {
        setStages((data ?? []) as LeadStage[])
        setLoading(false)
      })
  }, [clientId])

  return { stages, loading }
}

export function useLeads(clientId: string | null) {
  const [items, setItems] = useState<LeadItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!clientId) {
      setItems([])
      setLoading(false)
      return
    }
    const { data, error: err } = await supabase
      .from('leads')
      .select(
        'id, contact_id, conversation_id, stage_id, status, est_value, temperature_override, next_action, objection, lost_reason, updated_at, owner_id, created_by, contacts ( profile_name, channel, external_id ), conversations ( assigned_to, last_customer_message_at )',
      )
      .eq('client_id', clientId)
      .order('updated_at', { ascending: false })
      .limit(LEAD_LIMIT)

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }
    setError(null)
    setItems(
      (data ?? []).map((r) => {
        const row = r as unknown as Omit<LeadItem, 'contact' | 'conversation'> & {
          contacts: LeadItem['contact'] | LeadItem['contact'][]
          conversations: LeadItem['conversation'] | LeadItem['conversation'][]
        }
        return { ...row, contact: oneOf(row.contacts), conversation: oneOf(row.conversations) }
      }),
    )
    setLoading(false)
  }, [clientId])

  useEffect(() => {
    setLoading(true)
    void load()
  }, [load])

  return { items, loading, error, reload: load }
}

export function useFollowUps(clientId: string | null) {
  const [items, setItems] = useState<FollowUpItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!clientId) {
      setItems([])
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error: readError } = await supabase
      .from('follow_ups')
      .select('id, lead_id, contact_id, due_at, status, note, source_call_id')
      .eq('client_id', clientId)
      .in('status', ['pending', 'snoozed'])
      .order('due_at', { ascending: true })
      .limit(FOLLOW_UP_LIMIT)
    if (readError) {
      setItems([])
      setError(readError.message)
      setLoading(false)
      return
    }
    setError(null)
    setItems((data ?? []) as FollowUpItem[])
    setLoading(false)
  }, [clientId])

  useEffect(() => {
    void load()
  }, [load])

  return { items, loading, error, reload: load }
}

/**
 * Move a lead's stage. `leads` UPDATE is RLS-gated (migration 035): a manager
 * can move any lead in the tenant; an agent only a lead whose conversation is
 * assigned to them (`is_conversation_assignee`). A row this caller may not
 * touch is silently filtered by Postgres — PostgREST returns 200 with an empty
 * array, not an error — so a 0-length result here means "denied", not "bug".
 */
export async function moveLeadStage(
  clientId: string,
  leadId: string,
  stageId: string,
): Promise<{ ok: true } | { ok: false; reason: 'denied' | 'error'; message?: string }> {
  const { data, error } = await supabase
    .from('leads')
    .update({ stage_id: stageId })
    .eq('client_id', clientId)
    .eq('id', leadId)
    .select('id')

  if (error) return { ok: false, reason: 'error', message: error.message }
  if (!data || data.length === 0) return { ok: false, reason: 'denied' }
  return { ok: true }
}

// ── S11 SA-AUTO-01: Today's priority-stack actions ──────────────────────────
// The done/snooze affordances on a Today card were local-only state (the card
// vanished, the row never moved). These are the persisted versions; both mirror
// toggleTodo's contract — an empty result means RLS filtered the row, not an
// error. `follow_ups` UPDATE is granted to agent/manager/client_admin, so a rep
// can settle their own promise.
const SNOOZE_HOURS = 3

/** Settle a promise. */
export async function completeFollowUp(
  clientId: string,
  id: string,
): Promise<{ ok: true } | { ok: false; reason: 'denied' | 'error'; message?: string }> {
  const { data, error } = await supabase
    .from('follow_ups')
    .update({ status: 'done', completed_at: new Date().toISOString() })
    .eq('client_id', clientId)
    .eq('id', id)
    .select('id')
  if (error) return { ok: false, reason: 'error', message: error.message }
  if (!data || data.length === 0) return { ok: false, reason: 'denied' }
  return { ok: true }
}

/**
 * Push a promise out by SNOOZE_HOURS. `due_at` moves with `snoozed_until` on
 * purpose: due_at is what every ranking and the S11 nudge engine read, so a
 * snooze that only set snoozed_until would leave the card at the top of the
 * stack and the row permanently "due".
 */
export async function snoozeFollowUp(
  clientId: string,
  id: string,
  hours = SNOOZE_HOURS,
): Promise<{ ok: true; until: string } | { ok: false; reason: 'denied' | 'error'; message?: string }> {
  const until = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('follow_ups')
    .update({ status: 'snoozed', snoozed_until: until, due_at: until })
    .eq('client_id', clientId)
    .eq('id', id)
    .select('id')
  if (error) return { ok: false, reason: 'error', message: error.message }
  if (!data || data.length === 0) return { ok: false, reason: 'denied' }
  return { ok: true, until }
}
