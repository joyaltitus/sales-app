import { createClient } from '@supabase/supabase-js'
import { chromeStorage } from './storage'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const sharedAuth = {
  storage: chromeStorage,
  persistSession: true,
  detectSessionInUrl: false,
} as const

/** Long-lived extension page client: it may own the refresh timer. */
export function createPanelSupabase() {
  return createClient(url, anonKey, {
    auth: { ...sharedAuth, autoRefreshToken: true },
  })
}

/** MV3 worker client: getSession() refreshes an expired session on demand. */
export function createWorkerSupabase() {
  return createClient(url, anonKey, {
    auth: { ...sharedAuth, autoRefreshToken: false },
  })
}
