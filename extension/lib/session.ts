import type { Session } from '@supabase/supabase-js'
import { setSupabaseClient } from '@app/lib/supabase'
import { clearLeadDetails } from './cache'
import { panelSupabase } from './panel-client'
import { AUTH_NEEDS_SIGNIN_KEY } from './storage'

export type SessionCheck =
  | { ok: true; session: Session }
  | { ok: false; reason: 'signed_out' | 'refresh_failed'; message?: string }

export function installPanelClient(): void {
  setSupabaseClient(panelSupabase)
}

export async function checkPanelSession(): Promise<SessionCheck> {
  const { data, error } = await panelSupabase.auth.getSession()
  if (error) return { ok: false, reason: 'refresh_failed', message: error.message }
  if (!data.session) return { ok: false, reason: 'signed_out' }
  return { ok: true, session: data.session }
}

export async function signOutExtension(): Promise<void> {
  await panelSupabase.auth.signOut()
  await Promise.all([
    clearLeadDetails(),
    chrome.storage.local.remove(AUTH_NEEDS_SIGNIN_KEY),
  ])
}
