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

export const MOCK_REPS: MockRep[] = [
  { id: 'rep-1', name: 'Priya' },
  { id: 'rep-2', name: 'Arjun' },
  { id: 'rep-3', name: 'Sana' },
]

// Dashboard series (§S6 item 4) were here as DASH — retired in WIRE-B2/S10:
// response-time, volume-by-channel and per-rep stats now come from GET
// /api/metrics (src/lib/metrics-data.ts). See DashboardScreen.tsx.
