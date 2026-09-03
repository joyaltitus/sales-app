import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { Role } from '../shell/ClientProvider'

// AI-features reader/writer (AT-28) — `feature_grants`, the ENTITLEMENT table.
//
// It is now the ONLY door register. `flags.ts` used to read a second one — a
// per-tenant jsonb on `clients` — and 069 kept both alive while the question
// split in two: "is this door built for you" vs "did you buy it, is it switched
// on, and for which roles". One unauditable jsonb was the wrong answer to the
// first, so hub #276 collapsed them here and drops that column. `featureOn`
// answers both questions at once; a missing row still means a hidden door.
//
// THREE COLUMNS, THREE DIFFERENT AUTHORITIES:
//   granted       — what the plan includes. Writable only from a privileged
//                   server connection. 045's `tg_feature_grants_lock_granted`
//                   raises on any browser UPDATE that changes it, whatever RLS
//                   said (it tells a browser caller apart by auth.uid() being
//                   non-null). This module never sends it, and never offers to.
//                   The exact refusal text lives in that migration, not here —
//                   copying it into browser source would trip the law-8 marker
//                   scan, and the client's job is to relay the message it gets
//                   unchanged, not to know it in advance.
//   enabled       — the tenant's own on/off. client_admin writes it directly
//                   through the anon client under `feature_grants_update`.
//   enabled_roles — which roles see the feature. Same policy, same write.
//
// `featureOn` is COSMETIC. It decides whether a button is worth painting; it is
// not a permission. Every server path re-derives entitlement for itself (069's
// chokepoint), so a forced `true` here paints a button that still gets refused.
const GRANT_LIMIT = 100

export type FeatureGrant = {
  id: string
  feature: string
  granted: boolean
  enabled: boolean
  enabled_roles: string[]
}

/** Plain-language effect line per key. A key with no entry still renders — the
 *  feature name is shown as-is rather than the row being dropped, because a
 *  tenant paying for something must see it even if this map is out of date. */
const EFFECT: Record<string, string> = {
  agent_chat: 'The AI answers customers in the inbox. Replies still wait for a human when the playbook says so.',
  agent_autopilot: 'The AI sends routine replies without waiting for approval.',
  insights: 'Suggests a summary and a next action on each conversation.',
  product_ai: 'Reps can ask about a product mid-conversation and get the answer from your catalogue.',
  call_transcription: 'Calls are transcribed and scored against your playbook.',
  playbook_teardown: 'Weekly script win-rates and the gaps behind them.',
  campaign_attribution: 'Ties spend to leads and revenue per campaign.',
}

export function featureEffect(key: string): string | null {
  return EFFECT[key] ?? null
}

/** Tenant-wide rows only (`user_id IS NULL`); per-user overrides are a
 *  privileged server-side surface this screen does not manage. */
export function useFeatureGrants(clientId: string | null) {
  const [grants, setGrants] = useState<FeatureGrant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!clientId) {
      setGrants([])
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from('feature_grants')
      .select('id, feature, granted, enabled, enabled_roles')
      .eq('client_id', clientId)
      .is('user_id', null)
      .order('feature')
      .limit(GRANT_LIMIT)
    if (error) {
      setGrants([])
      setError(error.message)
      setLoading(false)
      return
    }
    setGrants((data ?? []) as FeatureGrant[])
    setError(null)
    setLoading(false)
  }, [clientId])

  useEffect(() => {
    void load()
  }, [load])

  return { grants, loading, error, reload: load }
}

/** Writes ONLY the two columns a tenant owns. `granted` is absent by
 *  construction, not by filtering — there is no code path here that sends it. */
export async function updateFeatureGrant(
  id: string,
  patch: { enabled?: boolean; enabled_roles?: string[] },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.from('feature_grants').update(patch).eq('id', id)
  return error ? { ok: false, message: error.message } : { ok: true }
}

/** Cosmetic gate. True only when the plan includes it, the tenant left it on,
 *  and the caller's role is in `enabled_roles`. The server decides for real. */
export function featureOn(grants: FeatureGrant[], key: string, role?: Role): boolean {
  const g = grants.find((x) => x.feature === key)
  if (!g || !g.granted || !g.enabled) return false
  return role ? g.enabled_roles.includes(role) : true
}
