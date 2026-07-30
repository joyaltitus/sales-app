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
// Employee plan — SAMPLE (Joyal's SA-05 ask: target / sold / pending /
// incentives per employee). No table holds targets or incentive rules yet;
// this is the UI's proposal for it. Sold/won are computed from REAL leads by
// the caller — only the plan numbers here are sample.

export const REP_PLAN = {
  monthlyTargetValue: 300_000, // ₹ won-lead value per month
  incentivePerWon: 2_000, // ₹ per won lead
  bonusAtTarget: 10_000, // ₹ on hitting the monthly target
}

// ---------------------------------------------------------------------------
// Hooks — same call shape as the real layer, so wiring is a body swap.

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
