// SA-04 FAKE-DATA layer — the ONE module every not-yet-wired screen reads.
//
// ⚠ NOTHING in this file touches the network. Every hook mirrors the shape of
// the real data layer (`inbox-data.ts` / `leads-data.ts`: `useX()` returning
// `{ items, loading }`), and every row type matches the REAL table's columns
// where the table exists (`contacts`, `bookings` — see db schema via
// Workbench's database.types.ts). A later wiring session replaces the body of
// each hook with a Supabase read and deletes the fixtures; callers should not
// need to change.
//
// `employee_todos` is NOT a real table yet (sales-ecosystem-brainstorm-seed.md
// Wave 1) — its shape here is the UI's proposal, clearly marked.
//
// Objection types come from the Wave-1 backlog (`leads.objection_type` enum —
// column exists, enum values proposed here).

import { useState } from 'react'

// ---------------------------------------------------------------------------
// Types — real-table shapes first

/** Matches `contacts` columns (subset the UI shows). */
export type MockContact = {
  id: string
  channel: 'whatsapp' | 'instagram'
  external_id: string
  profile_name: string | null
  notes: string | null
  is_vip: boolean
  is_opted_out: boolean
  created_at: string
  /** derived in the real layer from conversations.last_customer_message_at */
  last_activity_at: string | null
}

/** Matches `bookings` columns (subset the UI shows). */
export type MockBooking = {
  id: string
  booking_ref: string
  booking_mode: 'nights' | 'date_range' | 'slot'
  status: 'confirmed' | 'pending' | 'cancelled'
  payment_status: 'paid' | 'pending'
  customer_name: string | null
  checkin_date: string | null
  checkout_date: string | null
  slot_time: string | null
  guests: number | null
  total_price: number | null
  created_at: string
}

/** NOT a real table. UI proposal for Wave-1 `employee_todos`. */
export type MockTodo = {
  id: string
  title: string
  assignee: string
  due_at: string
  status: 'pending' | 'done'
  source: 'follow_up' | 'escalation' | 'manual'
}

/** Assignable reps for the conversation-assignment mock (`conversations.assigned_to`). */
export type MockRep = { id: string; name: string }

/** Proposed `leads.objection_type` enum values (column exists, enum does not). */
export const OBJECTION_TYPES = [
  'price',
  'timing',
  'trust',
  'competitor',
  'no_need',
  'other',
] as const
export type ObjectionType = (typeof OBJECTION_TYPES)[number]

// ---------------------------------------------------------------------------
// Fixtures — deterministic, realistic, obviously sample on close read

const H = 3_600_000
const D = 24 * H
/** Anchored at module load — a frozen calendar date would drift into the
 *  future/past of the viewer's clock and render nonsense wait stamps. */
const NOW = Date.now()
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString()

export const MOCK_REPS: MockRep[] = [
  { id: 'rep-1', name: 'Priya' },
  { id: 'rep-2', name: 'Arjun' },
  { id: 'rep-3', name: 'Sana' },
]

const CONTACTS: MockContact[] = [
  { id: 'ct-01', channel: 'whatsapp', external_id: '919812340001', profile_name: 'Ravi Menon', notes: 'Asked for weekend rates', is_vip: true, is_opted_out: false, created_at: iso(32 * D), last_activity_at: iso(2 * H) },
  { id: 'ct-02', channel: 'instagram', external_id: 'meera.travels', profile_name: 'Meera Pillai', notes: null, is_vip: false, is_opted_out: false, created_at: iso(21 * D), last_activity_at: iso(5 * H) },
  { id: 'ct-03', channel: 'whatsapp', external_id: '919812340003', profile_name: 'Joseph K', notes: 'Corporate — 12 rooms', is_vip: true, is_opted_out: false, created_at: iso(45 * D), last_activity_at: iso(26 * H) },
  { id: 'ct-04', channel: 'whatsapp', external_id: '919812340004', profile_name: 'Anita Shah', notes: null, is_vip: false, is_opted_out: false, created_at: iso(11 * D), last_activity_at: iso(3 * D) },
  { id: 'ct-05', channel: 'instagram', external_id: 'dev_kerala', profile_name: 'Dev Nair', notes: null, is_vip: false, is_opted_out: true, created_at: iso(60 * D), last_activity_at: iso(9 * D) },
  { id: 'ct-06', channel: 'whatsapp', external_id: '919812340006', profile_name: 'Lakshmi R', notes: 'Prefers Malayalam', is_vip: false, is_opted_out: false, created_at: iso(8 * D), last_activity_at: iso(30 * 60_000) },
  { id: 'ct-07', channel: 'whatsapp', external_id: '919812340007', profile_name: null, notes: null, is_vip: false, is_opted_out: false, created_at: iso(2 * D), last_activity_at: iso(6 * H) },
  { id: 'ct-08', channel: 'instagram', external_id: 'tanvi.b', profile_name: 'Tanvi Bhatt', notes: 'Honeymoon package', is_vip: false, is_opted_out: false, created_at: iso(5 * D), last_activity_at: iso(12 * H) },
]

const BOOKINGS: MockBooking[] = [
  { id: 'bk-01', booking_ref: 'BK-2047', booking_mode: 'nights', status: 'confirmed', payment_status: 'paid', customer_name: 'Ravi Menon', checkin_date: '2026-08-08', checkout_date: '2026-08-10', slot_time: null, guests: 2, total_price: 14500, created_at: iso(3 * H) },
  { id: 'bk-02', booking_ref: 'BK-2046', booking_mode: 'nights', status: 'pending', payment_status: 'pending', customer_name: 'Tanvi Bhatt', checkin_date: '2026-08-14', checkout_date: '2026-08-18', slot_time: null, guests: 2, total_price: 32000, created_at: iso(9 * H) },
  { id: 'bk-03', booking_ref: 'BK-2045', booking_mode: 'slot', status: 'confirmed', payment_status: 'paid', customer_name: 'Lakshmi R', checkin_date: '2026-08-02', checkout_date: null, slot_time: '11:00', guests: 4, total_price: 3600, created_at: iso(1 * D) },
  { id: 'bk-04', booking_ref: 'BK-2044', booking_mode: 'nights', status: 'confirmed', payment_status: 'pending', customer_name: 'Joseph K', checkin_date: '2026-09-01', checkout_date: '2026-09-04', slot_time: null, guests: 24, total_price: 168000, created_at: iso(2 * D) },
  { id: 'bk-05', booking_ref: 'BK-2043', booking_mode: 'nights', status: 'cancelled', payment_status: 'pending', customer_name: 'Anita Shah', checkin_date: '2026-08-05', checkout_date: '2026-08-06', slot_time: null, guests: 3, total_price: 7200, created_at: iso(4 * D) },
]

const TODOS: MockTodo[] = [
  { id: 'td-01', title: 'Call Ravi Menon back with weekend rate', assignee: 'Priya', due_at: iso(-2 * H), status: 'pending', source: 'follow_up' },
  { id: 'td-02', title: 'Send corporate quote to Joseph K', assignee: 'Arjun', due_at: iso(3 * H), status: 'pending', source: 'manual' },
  { id: 'td-03', title: 'Pick up escalated thread — Meera Pillai', assignee: 'Sana', due_at: iso(1 * H), status: 'pending', source: 'escalation' },
  { id: 'td-04', title: 'Confirm advance payment — Tanvi Bhatt', assignee: 'Priya', due_at: iso(-26 * H), status: 'pending', source: 'follow_up' },
  { id: 'td-05', title: 'Update room photos in catalog', assignee: 'Arjun', due_at: iso(-3 * D), status: 'done', source: 'manual' },
]

// ---------------------------------------------------------------------------
// Dashboard series — the KPIs a sales manager actually asks for (§S6 item 4).
// All FAKE. The real layer computes these from leads/messages/follow_ups.

export type FunnelStage = { label: string; count: number }
export type ChannelDay = { day: string; whatsapp: number; instagram: number }
export type RepStat = { name: string; replies: number; medianReplyMin: number; won: number }

export const DASH = {
  /** Pipeline conversion, newest cohort. */
  funnel: [
    { label: 'New', count: 128 },
    { label: 'Qualified', count: 74 },
    { label: 'Quoted', count: 41 },
    { label: 'Booked', count: 19 },
  ] as FunnelStage[],
  /** Median first-response minutes, last 14 days (one point per day). */
  responseMins: [12, 9, 14, 8, 7, 11, 6, 9, 5, 8, 7, 6, 9, 4],
  /** Inbound volume by channel, last 14 days. */
  volume: Array.from({ length: 14 }, (_, i) => ({
    day: new Date(NOW - (13 - i) * D).toISOString().slice(5, 10),
    whatsapp: [42, 38, 51, 47, 33, 29, 44, 56, 49, 39, 61, 53, 46, 58][i],
    instagram: [11, 9, 14, 12, 8, 6, 10, 15, 13, 9, 17, 14, 12, 16][i],
  })) as ChannelDay[],
  reps: [
    { name: 'Priya', replies: 214, medianReplyMin: 4, won: 9 },
    { name: 'Arjun', replies: 186, medianReplyMin: 7, won: 6 },
    { name: 'Sana', replies: 158, medianReplyMin: 5, won: 7 },
  ] as RepStat[],
  followUps: { done: 46, overdue: 9, dueToday: 12 },
  headline: {
    openConversations: 37,
    needsHuman: 4,
    bookingsWeek: 11,
    pipelineValue: 412000,
  },
}

// ---------------------------------------------------------------------------
// Hooks — same call shape as the real layer, so wiring is a body swap.

export function useMockContacts() {
  return { items: CONTACTS, loading: false as const }
}

export function useMockBookings() {
  return { items: BOOKINGS, loading: false as const }
}

/** Local-state-only todos: toggling "Done" works in the session, writes nowhere. */
export function useMockTodos() {
  const [items, setItems] = useState(TODOS)
  const toggle = (id: string) =>
    setItems((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, status: t.status === 'done' ? 'pending' : 'done' } : t,
      ),
    )
  return { items, loading: false as const, toggle }
}

export const mockNow = () => NOW
