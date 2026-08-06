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
// employee_todos / employee_targets are REAL tables now — their mock
// counterparts (MockTodo, useMockTodos, TODOS, REP_PLAN) were wired in the
// WIRE session and removed from here; see src/lib/todos-data.ts and
// src/lib/targets-data.ts.
//
// Objection types come from the Wave-1 backlog (`leads.objection_type` enum —
// column exists, enum values proposed here).

// ---------------------------------------------------------------------------
// Types — real-table shapes first

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

export const MOCK_REPS: MockRep[] = [
  { id: 'rep-1', name: 'Priya' },
  { id: 'rep-2', name: 'Arjun' },
  { id: 'rep-3', name: 'Sana' },
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

export const mockNow = () => NOW
