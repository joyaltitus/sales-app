import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Copy-once from Workbench, then owned. Anon key + the logged-in user's JWT
// ONLY — RLS is the tenant wall. Service-role must never reach this codebase
// (law 8; CI grep tripwire enforces).
type Client = SupabaseClient<any>

const inExtension = Boolean(
  (globalThis as { chrome?: { runtime?: { id?: string } } }).chrome?.runtime?.id,
)
const uninstalledClient = new Proxy({} as Client, {
  get() {
    throw new Error('Extension Supabase client was used before context startup')
  },
})

export let supabase: Client = inExtension
  ? uninstalledClient
  : createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_ANON_KEY,
      { realtime: { params: { eventsPerSecond: 5 } } },
    )

/**
 * Point the existing data modules at another anon-key client. The extension
 * uses this once at context startup so those modules keep their one shared
 * implementation while Auth persists in chrome.storage.local.
 */
export function setSupabaseClient(client: typeof supabase): void {
  supabase = client
}
