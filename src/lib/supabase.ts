import { createClient } from '@supabase/supabase-js'

// Copy-once from Workbench, then owned. Anon key + the logged-in user's JWT
// ONLY — RLS is the tenant wall. Service-role must never reach this codebase
// (law 8; CI grep tripwire enforces).
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    realtime: { params: { eventsPerSecond: 5 } },
  },
)
