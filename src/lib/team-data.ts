import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { hubFetch } from './api'
import type { HubResult } from './api'
import type { Role } from '../shell/ClientProvider'

// Team data layer (AT-27).
//
// READS are plain anon-key PostgREST, RLS is the wall: 069's `ucm_team_select`
// lets a manager or client_admin select their whole tenant's memberships, while
// an agent keeps `ucm_select` and sees only their own row. That is why reps have
// no Team page — not because this file hides one, but because the rows are not
// theirs to read. Display names are joined from `profiles` client-side, the same
// way crm-data.ts's roster probe does it (PostgREST cannot embed across these
// two without a declared FK).
//
// WRITES never touch the table. 069's `tg_memberships_role_lock` blocks minting
// a membership or changing a role on ANY browser write, super_admin included, so
// both mutations below go through hub-service's service-role admin API, which
// re-derives the caller's role from the JWT and enforces the mint ladder
// (client_admin → manager|agent, manager → agent, nobody → their own level).
//
// This module reports hub-service's refusal code VERBATIM. `role_above_caller`
// is the server's sentence on the caller's authority, and softening it into
// "something went wrong" would hide the one fact the operator needs.
const TEAM_LIMIT = 200

export const ADMIN_USERS_PATH = '/api/admin/users'

export type TeamMember = {
  user_id: string
  role: Role
  display_name: string | null
  disabled_at: string | null
}

/** Bounded, tenant-scoped roster. Errors surface — unlike the CRM label
 *  control's roster probe, an empty Team page is a fact worth explaining. */
export function useTeam(clientId: string | null) {
  const [items, setItems] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!clientId) {
      setItems([])
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const [membersRes, profilesRes] = await Promise.all([
      supabase
        .from('user_client_memberships')
        .select('user_id, role, disabled_at')
        .eq('client_id', clientId)
        .limit(TEAM_LIMIT),
      supabase
        .from('profiles')
        .select('user_id, display_name')
        .eq('client_id', clientId)
        .limit(TEAM_LIMIT),
    ])
    if (membersRes.error) {
      setItems([])
      setError(membersRes.error.message)
      setLoading(false)
      return
    }
    // A denied/empty profiles read is not fatal: the roster is still true, the
    // rows just show as unnamed rather than vanishing.
    const names = new Map(
      ((profilesRes.data ?? []) as { user_id: string; display_name: string }[]).map((p) => [
        p.user_id,
        p.display_name,
      ]),
    )
    const rows = ((membersRes.data ?? []) as {
      user_id: string
      role: Role
      disabled_at: string | null
    }[]).map((m) => ({
      user_id: m.user_id,
      role: m.role,
      display_name: names.get(m.user_id) ?? null,
      disabled_at: m.disabled_at,
    }))
    // Active before disabled, then by name — a disabled row is history, not work.
    rows.sort((a, b) => {
      if (!a.disabled_at !== !b.disabled_at) return a.disabled_at ? 1 : -1
      return (a.display_name ?? '').localeCompare(b.display_name ?? '')
    })
    setItems(rows)
    setError(null)
    setLoading(false)
  }, [clientId])

  useEffect(() => {
    void load()
  }, [load])

  return { items, loading, error, reload: load }
}

export type AddMemberResult =
  | { kind: 'ok'; created: boolean; disabled: boolean }
  | { kind: 'existing_platform_user' } // 409 — needs an explicit second attempt
  | { kind: 'error'; code: string }

/** The failure code an operator should read, verbatim where hub-service gave
 *  one. `kind` is the fallback for transport-level failures that never reached
 *  a handler and so have no code of their own. */
function failureCode(res: Exclude<HubResult<unknown>, { kind: 'ok' }>): string {
  return 'code' in res && res.code ? res.code : res.kind
}

/** POST /api/admin/users — mint the level below you. `client_id` is always sent:
 *  hub-service reads it only as a disambiguator between the caller's OWN
 *  memberships, so naming the active workspace is both safe and the thing that
 *  stops a two-tenant caller getting 400 ambiguous_client. */
export async function addTeamMember(opts: {
  clientId: string
  email: string
  role: Extract<Role, 'manager' | 'agent'>
  displayName: string
  /** Second attempt after `existing_platform_user`, once a human has agreed to
   *  attach an address that already has an account elsewhere. */
  allowExistingUser?: boolean
}): Promise<AddMemberResult> {
  const res = await hubFetch<{ created?: boolean; disabled?: boolean }>(ADMIN_USERS_PATH, {
    method: 'POST',
    body: JSON.stringify({
      client_id: opts.clientId,
      email: opts.email,
      role: opts.role,
      display_name: opts.displayName,
      ...(opts.allowExistingUser ? { allow_existing_user: true } : {}),
    }),
  })
  if (res.kind === 'ok') {
    return { kind: 'ok', created: res.data?.created ?? false, disabled: res.data?.disabled ?? false }
  }
  if (res.kind === 'conflict' && res.code === 'existing_platform_user') {
    return { kind: 'existing_platform_user' }
  }
  return { kind: 'error', code: failureCode(res) }
}

/** POST /api/admin/users/:id/disable — membership first, GoTrue ban second
 *  (hub-service's order, so a live JWT stops working before the account does).
 *  Refuses self-disable with `role_above_caller`, which this shows verbatim. */
export async function disableTeamMember(opts: {
  clientId: string
  userId: string
}): Promise<{ kind: 'ok'; banned: boolean } | { kind: 'error'; code: string }> {
  const res = await hubFetch<{ banned?: boolean }>(
    `${ADMIN_USERS_PATH}/${encodeURIComponent(opts.userId)}/disable`,
    { method: 'POST', body: JSON.stringify({ client_id: opts.clientId }) },
  )
  if (res.kind === 'ok') return { kind: 'ok', banned: res.data?.banned ?? false }
  return { kind: 'error', code: failureCode(res) }
}

/** The mint ladder, mirrored for the UI only. hub-service enforces the real one
 *  on every request (`canMint`); this just avoids offering a button that is
 *  guaranteed to come back 403. */
export function mintableBy(role: Role | undefined): Array<Extract<Role, 'manager' | 'agent'>> {
  if (role === 'client_admin') return ['manager', 'agent']
  if (role === 'manager') return ['agent']
  return []
}
