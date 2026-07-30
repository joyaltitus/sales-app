import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

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

export type Teammate = { user_id: string; role: string }

/** SA-06 roster probe — teammates of the active client, for the label
 *  (assignment) control. `user_client_memberships` may be RLS-scoped to the
 *  caller's own rows; an empty/denied result degrades the UI to Me/Unassign
 *  only, it is not an error. Display names need a profiles table (backlog) —
 *  until then teammates render as role + short id. */
export function useTeammates(clientId: string | null) {
  const [items, setItems] = useState<Teammate[]>([])

  useEffect(() => {
    let cancelled = false
    if (!clientId) {
      setItems([])
      return
    }
    void (async () => {
      const { data } = await supabase
        .from('user_client_memberships')
        .select('user_id, role')
        .eq('client_id', clientId)
        .limit(50)
      if (!cancelled) setItems((data ?? []) as Teammate[])
    })()
    return () => {
      cancelled = true
    }
  }, [clientId])

  return { items }
}

/** Short human-usable label for a teammate until real names exist. */
export function teammateLabel(t: Teammate): string {
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
        'id, contact_id, conversation_id, stage_id, status, est_value, temperature_override, objection',
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
  const conversationId = key.conversationId ?? null
  const leadId = key.leadId ?? null

  const load = useCallback(async () => {
    if (!clientId || (!conversationId && !leadId)) {
      setItems([])
      return
    }
    let q = supabase
      .from('conversation_notes')
      .select('id, conversation_id, lead_id, author, body, created_at')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(NOTE_LIMIT)
    q = conversationId ? q.eq('conversation_id', conversationId) : q.eq('lead_id', leadId!)
    const { data } = await q
    setItems((data ?? []) as NoteRow[])
  }, [clientId, conversationId, leadId])

  useEffect(() => {
    void load()
  }, [load])

  return { items, reload: load }
}
