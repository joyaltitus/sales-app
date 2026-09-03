import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { WriteResult } from './manage-data'

// Outbound data layer (S2-E1) — broadcasts, the WhatsApp template registry, and
// the one-off template send the Inbox falls back to when the 24h window shuts.
//
// Ported from Workbench's Broadcasts.tsx / TemplatesWA.tsx: plain PostgREST
// under RLS, `.eq('client_id')` explicit at every call site, bounded reads. No
// hub endpoint exists for any of this and none should be invented — the browser
// writes rows and the outreach lanes in hub-service drain them:
//
//   meta.broadcast_id set   → src/outreach/drainer.ts   (broadcast lane)
//   meta.template_id, no
//   broadcast_id, no
//   sequence_key            → src/outreach/followups.ts (follow-up lane)
//
// Those two WHERE clauses are why the insert shapes below are exact rather than
// approximate: a stray `sequence_key` moves a row into the sequence lane and it
// is never sent.
//
// The registry is READ-ONLY here on purpose: `wa_templates_write` is
// super_admin. Meta approves templates, an operator registers them, the client
// picks from them.
const BROADCAST_LIMIT = 100
const TEMPLATE_LIMIT = 100
const SEGMENT_LEAD_LIMIT = 500

export type BroadcastCounts = { queued?: number; sent?: number; failed?: number; replied?: number }

export type Broadcast = {
  id: string
  client_id: string
  name: string
  template_id: string
  status: string
  counts: BroadcastCounts | null
  created_at: string
}

export type WaTemplate = {
  id: string
  template_name: string
  language: string
  category: string
  body_preview: string | null
  variables: string[]
  meta_status: string
  active: boolean
}

export type SegmentLead = {
  stage_id: string
  status: string
  source: string
  campaign_id: string | null
  est_value: number | null
  contact: {
    id: string
    profile_name: string | null
    external_id: string
    channel: string
    is_opted_out: boolean
  } | null
}

export type Filters = {
  q: string
  stage: string
  status: string
  source: string
  channel: string
  campaign: string
  minv: string
  maxv: string
}

export const EMPTY_FILTERS: Filters = {
  q: '', stage: '', status: '', source: '', channel: '', campaign: '', minv: '', maxv: '',
}

/** Segment scope, verbatim from Workbench: stage / status / source / channel /
 *  campaign / est_value range / search. It deliberately skips CRM's
 *  temperature / activity / follow-up / booked filters — those are engagement
 *  nudges, not "who should receive this blast". */
export function matchesFilters(l: SegmentLead, f: Filters): boolean {
  if (f.stage && l.stage_id !== f.stage) return false
  if (f.status && l.status !== f.status) return false
  if (f.source && l.source !== f.source) return false
  if (f.channel && (l.contact?.channel ?? 'whatsapp') !== f.channel) return false
  if (f.campaign && l.campaign_id !== f.campaign) return false
  if (f.minv && !(l.est_value != null && Number(l.est_value) >= Number(f.minv))) return false
  if (f.maxv && !(l.est_value != null && Number(l.est_value) <= Number(f.maxv))) return false
  if (f.q) {
    const needle = f.q.toLowerCase()
    const hay = `${l.contact?.profile_name ?? ''} ${l.contact?.external_id ?? ''}`.toLowerCase()
    if (!hay.includes(needle)) return false
  }
  return true
}

export type Recipient = { id: string; name: string }

/** A blast messages a CONTACT once, not once per lead that contact happens to
 *  have — so the segment collapses to distinct contacts.
 *
 *  Instagram contacts are EXCLUDED and surfaced, never silently dropped: a
 *  broadcast is a WhatsApp TEMPLATE send and Instagram forbids automated pushes
 *  outright. Opted-out contacts are excluded here AND server-side by the
 *  outreach opt-out gate; neither is load-bearing alone. */
export function resolveSegment(
  leads: SegmentLead[],
  filters: Filters,
): { recipients: Recipient[]; igExcluded: string[] } {
  const byContact = new Map<string, Recipient>()
  const igOnly = new Map<string, string>()
  for (const l of leads) {
    if (!matchesFilters(l, filters)) continue
    const c = l.contact
    if (!c || c.is_opted_out) continue
    const name = c.profile_name || c.external_id || '?'
    if ((c.channel ?? 'whatsapp') !== 'whatsapp') {
      igOnly.set(c.id, name)
      continue
    }
    if (!byContact.has(c.id)) byContact.set(c.id, { id: c.id, name })
  }
  return { recipients: [...byContact.values()], igExcluded: [...igOnly.values()] }
}

/** Rough per-message cost by WhatsApp template category — NOT exact billing
 *  (that depends on live Meta pricing and country). Shown as an estimate only,
 *  because the compliance rail requires a cost figure before a send and a
 *  missing number is worse than an approximate one. */
export const COST_PER_MSG_INR: Record<string, number> = {
  utility: 0.35,
  marketing: 0.95,
  authentication: 0.35,
}

export function estimateCost(category: string, recipients: number): number {
  return recipients * (COST_PER_MSG_INR[category] ?? 0.5)
}

/** Meta accepts a send only when the params count equals the template's body
 *  variables; pm_prepare_template_send rejects the mismatch server-side with
 *  `params_mismatch`. Surfaced in the picker so the rejection is visible before
 *  the send rather than in a counts column afterwards. */
export function sendable(t: WaTemplate): boolean {
  return t.meta_status === 'approved' && t.active
}

function failed(message: string): WriteResult {
  return { ok: false, code: 'write_failed', detail: message }
}

function rowsOf<T>(data: unknown): T[] {
  return (data ?? []) as T[]
}

export function useWaTemplates(clientId: string | null) {
  const [items, setItems] = useState<WaTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!clientId) {
      setItems([])
      setLoading(false)
      return
    }
    const { data, error: err } = await supabase
      .from('wa_templates')
      .select('id, template_name, language, category, body_preview, variables, meta_status, active')
      .eq('client_id', clientId)
      .order('template_name', { ascending: true })
      .limit(TEMPLATE_LIMIT)
    setError(err ? err.message : null)
    setItems(err ? [] : rowsOf<WaTemplate>(data))
    setLoading(false)
  }, [clientId])

  useEffect(() => {
    void load()
  }, [load])

  return { items, loading, error, reload: load }
}

export function useBroadcasts(clientId: string | null) {
  const [items, setItems] = useState<Broadcast[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!clientId) {
      setItems([])
      setLoading(false)
      return
    }
    const { data, error: err } = await supabase
      .from('broadcasts')
      .select('id, client_id, name, template_id, status, counts, created_at')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(BROADCAST_LIMIT)
    setError(err ? err.message : null)
    setItems(err ? [] : rowsOf<Broadcast>(data))
    setLoading(false)
  }, [clientId])

  useEffect(() => {
    void load()
  }, [load])

  // hub-service patches `counts` from its own tick while a broadcast runs, so a
  // list that only refetched on write would freeze mid-send — which is exactly
  // when someone is watching it. Polled rather than subscribed: the poll stops
  // dead once nothing is in flight, and a realtime channel for one screen's
  // progress bar is a subscription to keep alive forever for a state that lasts
  // minutes.
  // ponytail: 15s poll while in flight; swap for a realtime channel only if
  // someone needs sub-second counts.
  const inFlight = items.some((b) => b.status === 'sending' || b.status === 'queued')
  useEffect(() => {
    if (!clientId || !inFlight) return
    const t = setInterval(() => void load(), 15_000)
    return () => clearInterval(t)
  }, [clientId, inFlight, load])

  return { items, loading, error, reload: load }
}

/** The segment source. Its own read rather than `useLeads`: that one omits
 *  `source`, `campaign_id` and the contact's `id`/`is_opted_out`, and widening
 *  it would make every CRM screen pay for this one. */
export function useSegmentLeads(clientId: string | null, enabled: boolean) {
  const [items, setItems] = useState<SegmentLead[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!clientId || !enabled) return
    let live = true
    setLoading(true)
    void supabase
      .from('leads')
      .select(
        'stage_id, status, source, campaign_id, est_value, contacts ( id, profile_name, external_id, channel, is_opted_out )',
      )
      .eq('client_id', clientId)
      .limit(SEGMENT_LEAD_LIMIT)
      .then(({ data }) => {
        if (!live) return
        setItems(
          rowsOf<Omit<SegmentLead, 'contact'> & { contacts: SegmentLead['contact'] | SegmentLead['contact'][] }>(
            data,
          ).map((r) => ({
            ...r,
            // Supabase types a to-one embed as an array; at runtime it is the row.
            contact: Array.isArray(r.contacts) ? (r.contacts[0] ?? null) : r.contacts,
          })),
        )
        setLoading(false)
      })
    return () => {
      live = false
    }
  }, [clientId, enabled])

  return { items, loading }
}

export type CampaignOption = { id: string; name: string }

export function useCampaignOptions(clientId: string | null, enabled: boolean) {
  const [items, setItems] = useState<CampaignOption[]>([])
  useEffect(() => {
    if (!clientId || !enabled) return
    void supabase
      .from('campaigns')
      .select('id, name')
      .eq('client_id', clientId)
      .order('name', { ascending: true })
      .limit(TEMPLATE_LIMIT)
      .then(({ data }) => setItems(rowsOf<CampaignOption>(data)))
  }, [clientId, enabled])
  return items
}

/** Create the broadcast row, then one pending follow_up per recipient.
 *
 *  Two statements, not one, and the order matters: the follow_ups carry
 *  `meta.broadcast_id`, so the broadcast must exist first. If the second
 *  statement fails the broadcast is left with zero recipients — visible as a
 *  queued row that never moves, which is the honest outcome. It is NOT rolled
 *  back from the browser: an anon-key client has no transaction, and a delete
 *  racing the drainer is worse than a stalled row.
 *
 *  `{{contact_name}}` in any param is substituted per recipient — the one piece
 *  of personalisation a template blast gets.
 *
 *  An imported cohort still under the S2-D do-not-message guard is rejected by
 *  the DB on this insert. That error is surfaced verbatim rather than
 *  pre-filtered here: the guard is the law, and a browser that quietly dropped
 *  the guarded contacts would be a second, weaker copy of it. */
export async function createBroadcast(args: {
  clientId: string
  userId: string
  name: string
  template: WaTemplate
  filters: Filters
  recipients: Recipient[]
  params: string[]
}): Promise<WriteResult> {
  const { clientId, userId, name, template, filters, recipients, params } = args
  if (recipients.length === 0) return { ok: false, code: 'empty_segment' }

  const { data, error } = await supabase
    .from('broadcasts')
    .insert({
      client_id: clientId,
      name: name.trim() || `${template.template_name} blast`,
      template_id: template.id,
      params_map: params,
      segment_snapshot: {
        filters,
        contact_ids: recipients.map((c) => c.id),
        resolved_at: new Date().toISOString(),
      },
      status: 'queued',
      counts: { queued: recipients.length, sent: 0, failed: 0, replied: 0 },
      created_by: userId,
    })
    .select('id')
    .single()
  if (error || !data) return failed(error?.message ?? 'no row')

  const broadcastId = (data as { id: string }).id
  const { error: fe } = await supabase.from('follow_ups').insert(
    recipients.map((c) => ({
      client_id: clientId,
      contact_id: c.id,
      due_at: new Date().toISOString(),
      note: `Broadcast: ${name.trim() || template.template_name}`,
      channel: 'whatsapp',
      status: 'pending',
      sequence_key: `broadcast:${broadcastId}`,
      meta: {
        kind: 'broadcast',
        broadcast_id: broadcastId,
        template_id: template.id,
        params: params.map((p) => p.replaceAll('{{contact_name}}', c.name)),
      },
      created_by: userId,
    })),
  )
  if (fe) return { ok: false, code: 'recipients_failed', detail: fe.message }
  return { ok: true }
}

/** Stop, then cancel whatever has not been picked up yet. The update is guarded
 *  on `status='sending'` so a broadcast that finished between render and click
 *  is not resurrected into a stopped state. Already-sent messages are gone —
 *  nothing here pretends otherwise. */
export async function stopBroadcast(b: Broadcast): Promise<WriteResult> {
  const { data, error } = await supabase
    .from('broadcasts')
    .update({ status: 'stopped' })
    .eq('id', b.id)
    .eq('status', 'sending')
    .select('id')
  if (error) return failed(error.message)
  if (!(data as unknown[] | null)?.length) return { ok: false, code: 'not_sending' }

  await supabase
    .from('follow_ups')
    .update({ status: 'cancelled', completed_at: new Date().toISOString() })
    .eq('client_id', b.client_id)
    .eq('sequence_key', `broadcast:${b.id}`)
    .eq('status', 'pending')
  return { ok: true }
}

/** One template send to one contact — the Inbox's answer to a shut 24h window.
 *
 *  No `sequence_key` and no `meta.broadcast_id`: both are the follow-up lane's
 *  WHERE clause, and either one would route this row to a lane that ignores it.
 *  `auto_send` is what separates a message from a CRM reminder.
 *
 *  `conversation_id` is set even though pm_prepare_template_send can find one
 *  itself, because the lane builds its send job from the follow_up's OWN joins
 *  — a row without it resolves an empty phone_number_id and the send dies
 *  downstream with nothing to point at. */
export async function sendTemplateNow(args: {
  clientId: string
  userId: string
  contactId: string
  conversationId: string
  template: WaTemplate
  params: string[]
}): Promise<WriteResult> {
  const { clientId, userId, contactId, conversationId, template, params } = args
  const { error } = await supabase.from('follow_ups').insert({
    client_id: clientId,
    contact_id: contactId,
    conversation_id: conversationId,
    due_at: new Date().toISOString(),
    note: `Template: ${template.template_name}`,
    channel: 'whatsapp',
    status: 'pending',
    meta: { template_id: template.id, auto_send: true, params },
    created_by: userId,
  })
  if (error) return failed(error.message)
  return { ok: true }
}
