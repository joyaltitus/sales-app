import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { parseFacts, type QueueItem } from './inbox-data'
import type { LeadFact } from './lead-facts'

// SA-05 CRM data layer — REAL PostgREST reads for the CRM tabs that shipped as
// sample data in SA-04. Same laws as inbox-data.ts / leads-data.ts: explicit
// `.eq('client_id', …)` AND RLS underneath, bounded lists, no RPCs/views.
// Workbench already issues these exact reads browser-side under the anon key,
// so no policy is being widened by reading them here.
const CONTACT_LIMIT = 500
const BOOKING_LIMIT = 200
const NOTE_LIMIT = 50

export type ContactRow = {
  id: string
  channel: string
  external_id: string
  profile_name: string | null
  profile: unknown
  notes: string | null
  is_vip: boolean
  is_opted_out: boolean
  created_at: string
}

export type BookingRow = {
  id: string
  booking_ref: string | null
  booking_mode: string | null
  status: string | null
  payment_status: string | null
  customer_name: string | null
  checkin_date: string | null
  checkout_date: string | null
  start_date: string | null
  end_date: string | null
  slot_time: string | null
  guests: number | null
  party_size: number | null
  total_price: number | null
  contact_id: string | null
  created_at: string
}

export type NoteRow = {
  id: string
  conversation_id: string | null
  lead_id: string | null
  author: string | null
  body: string
  created_at: string
}

export function useContacts(clientId: string | null) {
  const [items, setItems] = useState<ContactRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!clientId) {
      setItems([])
      setLoading(false)
      return
    }
    const { data } = await supabase
      .from('contacts')
      .select(
        'id, channel, external_id, profile_name, profile, notes, is_vip, is_opted_out, created_at',
      )
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(CONTACT_LIMIT)
    setItems((data ?? []) as ContactRow[])
    setLoading(false)
  }, [clientId])

  useEffect(() => {
    void load()
  }, [load])

  return { items, loading, reload: load }
}

export function useBookings(clientId: string | null) {
  const [items, setItems] = useState<BookingRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!clientId) {
      setItems([])
      setLoading(false)
      return
    }
    const { data } = await supabase
      .from('bookings')
      .select(
        'id, booking_ref, booking_mode, status, payment_status, customer_name, checkin_date, checkout_date, start_date, end_date, slot_time, guests, party_size, total_price, contact_id, created_at',
      )
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(BOOKING_LIMIT)
    setItems((data ?? []) as BookingRow[])
    setLoading(false)
  }, [clientId])

  useEffect(() => {
    void load()
  }, [load])

  return { items, loading, reload: load }
}

export type Teammate = { user_id: string; role: string; displayName?: string | null }

/** SA-06 roster probe — teammates of the active client, for the label
 *  (assignment) control. user_client_memberships may be RLS-scoped to the
 *  caller's own rows; an empty/denied result degrades the UI to Me/Unassign
 *  only, it is not an error. Display names are joined from profiles client-side. */
export function useTeammates(clientId: string | null) {
  const [items, setItems] = useState<Teammate[]>([])

  useEffect(() => {
    let cancelled = false
    if (!clientId) {
      setItems([])
      return
    }
    void (async () => {
      const [membersRes, profilesRes] = await Promise.all([
        supabase
          .from('user_client_memberships')
          .select('user_id, role')
          .eq('client_id', clientId)
          .limit(50),
        supabase
          .from('profiles')
          .select('user_id, display_name')
          .eq('client_id', clientId)
          .limit(50),
      ])
      if (cancelled) return
      const names = new Map(
        ((profilesRes.data ?? []) as { user_id: string; display_name: string }[]).map((p) => [
          p.user_id,
          p.display_name,
        ]),
      )
      const members = ((membersRes.data ?? []) as { user_id: string; role: string }[]).map((m) => ({
        ...m,
        displayName: names.get(m.user_id) ?? null,
      }))
      setItems(members)
    })()
    return () => {
      cancelled = true
    }
  }, [clientId])

  return { items }
}

/** Human-usable label for a teammate — uses profile display name when known. */
export function teammateLabel(t: Teammate): string {
  if (t.displayName) return t.displayName
  return `${t.role === 'agent' ? 'Rep' : t.role} · ${t.user_id.slice(0, 4)}`
}

export type ConvLead = {
  id: string
  contact_id: string
  conversation_id: string | null
  stage_id: string
  status: string
  est_value: number | null
  temperature_override: string | null
  objection: string | null
  next_action: string | null
}

/** The open lead behind one conversation's contact (context rail). */
export function useConvLead(clientId: string | null, contactId: string | null) {
  const [lead, setLead] = useState<ConvLead | null>(null)

  const load = useCallback(async () => {
    if (!clientId || !contactId) {
      setLead(null)
      return
    }
    const { data } = await supabase
      .from('leads')
      .select(
        'id, contact_id, conversation_id, stage_id, status, est_value, temperature_override, objection, next_action',
      )
      .eq('client_id', clientId)
      .eq('contact_id', contactId)
      .eq('status', 'open')
      .order('updated_at', { ascending: false })
      .limit(1)
    setLead(((data ?? [])[0] as ConvLead | undefined) ?? null)
  }, [clientId, contactId])

  useEffect(() => {
    void load()
  }, [load])

  return { lead, reload: load }
}

/** CSV download — ported verbatim from Workbench lib/ui.tsx. */
export function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
) {
  const esc = (v: string | number | null | undefined) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n')
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Notes for one conversation (context rail) or one lead (drawer). */
export function useNotes(
  clientId: string | null,
  key: { conversationId?: string | null; leadId?: string | null },
) {
  const [items, setItems] = useState<NoteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const conversationId = key.conversationId ?? null
  const leadId = key.leadId ?? null

  const load = useCallback(async () => {
    if (!clientId || (!conversationId && !leadId)) {
      setItems([])
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    let q = supabase
      .from('conversation_notes')
      .select('id, conversation_id, lead_id, author, body, created_at')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(NOTE_LIMIT)
    q = conversationId ? q.eq('conversation_id', conversationId) : q.eq('lead_id', leadId!)
    const { data, error: readError } = await q
    setError(readError?.message ?? null)
    setItems(readError ? [] : (data ?? []) as NoteRow[])
    setLoading(false)
  }, [clientId, conversationId, leadId])

  useEffect(() => {
    void load()
  }, [load])

  return { items, loading, error, reload: load }
}

/** Customer memory facts for a contact / lead in CRM drawer. */
export function useLeadMemory(
  clientId: string | null,
  contactId: string | null,
  conversationId: string | null,
) {
  const [facts, setFacts] = useState<LeadFact[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const requestGeneration = useRef(0)

  const load = useCallback(async () => {
    const generation = ++requestGeneration.current
    if (!clientId || !contactId) {
      setFacts([])
      setError(null)
      setLoading(false)
      return
    }
    setFacts([])
    setError(null)
    setLoading(true)
    try {
      const [contactRes, convRes] = await Promise.all([
        supabase
          .from('contacts')
          .select('profile_name, channel, external_id, profile, is_opted_out, captured_fields')
          .eq('client_id', clientId)
          .eq('id', contactId)
          .maybeSingle(),
        conversationId
          ? supabase
              .from('conversations')
              .select(
                'id, contact_id, status, bot_paused, unread_count, last_customer_message_at, last_bot_message_at, escalation_resolved, assigned_to, rolling_summary, summary_upto, extracted_fields',
              )
              .eq('client_id', clientId)
              .eq('id', conversationId)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ])

      if (generation !== requestGeneration.current) return
      const readError = contactRes.error ?? convRes.error
      if (readError) {
        setFacts([])
        setError(readError.message)
        setLoading(false)
        return
      }

      const contact = contactRes.data as QueueItem['contact'] | null
      const conv = convRes.data as Record<string, unknown> | null

      const item: QueueItem = {
        id: conversationId ?? `contact-${contactId}`,
        contact_id: contactId,
        status: (conv?.status as string) ?? 'open',
        bot_paused: Boolean(conv?.bot_paused),
        unread_count: Number(conv?.unread_count ?? 0),
        last_customer_message_at: (conv?.last_customer_message_at as string) ?? null,
        last_bot_message_at: (conv?.last_bot_message_at as string) ?? null,
        escalation_resolved: Boolean(conv?.escalation_resolved),
        assigned_to: (conv?.assigned_to as string) ?? null,
        contact: contact ?? null,
        rolling_summary: (conv?.rolling_summary as string) ?? null,
        summary_upto: (conv?.summary_upto as string) ?? null,
        extracted_fields: (conv?.extracted_fields as Record<string, unknown>) ?? null,
      }

      setFacts(parseFacts(item))
      setLoading(false)
    } catch (cause) {
      if (generation !== requestGeneration.current) return
      setFacts([])
      setError(cause instanceof Error ? cause.message : 'Failed to load customer memory.')
      setLoading(false)
    }
  }, [clientId, contactId, conversationId])

  useEffect(() => {
    void load()
    return () => {
      requestGeneration.current++
    }
  }, [load])

  return { facts, loading, error, reload: load }
}
