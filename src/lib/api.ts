import { supabase } from './supabase'
import { loadGatewayKey } from './gateway-key'

// hub-service HTTP client (contract class W3, MASTER-PLAN §E).
//
// SA-01b fixed four independent breakages that had never been exercised, because
// STATE.md records that sales-app had never called hub-service at all:
//   1. this file sent `authorization: Bearer <jwt>`; hub-service reads the JWT
//      from `x-pm-user-jwt` (hub-service src/api/auth.ts:65).
//   2. it sent no `x-pm-gateway-key`; checkGatewayAndJwt requires it (auth.ts:62).
//   3. `authorization` is not in hub-service's CORS allowedHeaders — the list is
//      exactly `content-type, x-pm-gateway-key, x-pm-user-jwt` (app.ts:112) — so
//      the preflight failed regardless of whether the token was right.
//   4. VITE_HUB_API_BASE was present-but-empty, so `${BASE}${path}` resolved
//      same-origin and 404'd.
//
// The three headers below MIRROR that allowedHeaders list exactly. Adding a
// fourth header here without adding it there produces a passing preflight and a
// failing POST, which hub-service's own comment calls "the worst kind of green".
const BASE = import.meta.env.VITE_HUB_API_BASE ?? ''

/** Discriminated result — every hub-service failure matrix code gets a name, so
 *  the UI can say what happened rather than rendering a bare status number. */
export type HubResult<T> =
  | { kind: 'ok'; data: T }
  | { kind: 'no_key' } //        gateway key not pasted in this browser yet
  | { kind: 'no_session' } //    no Supabase session (should be impossible behind the auth gate)
  | { kind: 'unauthorized' } //  401 — bad gateway key or invalid/expired JWT
  | { kind: 'forbidden' } //     403 — authenticated, but this role may not do this
  | { kind: 'not_found' } //     404 — conversation missing, or no resolvable send route
  | { kind: 'bad_request' } //   400 — malformed body (a bug here, not a user error)
  | { kind: 'paused' } //        503 'paused' — the agent_send kill-switch is passive
  | { kind: 'unavailable' } //   503 — auth/DB/enqueue backend down; not the caller's fault
  | { kind: 'network'; message: string } // fetch threw: offline, DNS, or CORS

export async function hubFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<HubResult<T>> {
  const key = loadGatewayKey()
  if (!key) return { kind: 'no_key' }

  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) return { kind: 'no_session' }

  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        'x-pm-gateway-key': key,
        'x-pm-user-jwt': token,
        ...(init.headers ?? {}),
      },
    })
  } catch (e) {
    return { kind: 'network', message: e instanceof Error ? e.message : String(e) }
  }

  if (res.ok) {
    let body: unknown = null
    try {
      body = await res.json()
    } catch {
      /* tolerate an empty or non-JSON 200 */
    }
    return { kind: 'ok', data: body as T }
  }

  if (res.status === 400) return { kind: 'bad_request' }
  if (res.status === 401) return { kind: 'unauthorized' }
  if (res.status === 403) return { kind: 'forbidden' }
  if (res.status === 404) return { kind: 'not_found' }
  if (res.status === 503) {
    // hub-service distinguishes 'paused' (kill-switch passive) from 'disabled' /
    // 'auth_unavailable' / 'db_unavailable' / 'enqueue_unavailable' in the body.
    let reason: string | undefined
    try {
      reason = ((await res.json()) as { error?: string }).error
    } catch {
      /* fall through to the generic unavailable */
    }
    return reason === 'paused' ? { kind: 'paused' } : { kind: 'unavailable' }
  }
  return { kind: 'network', message: `HTTP ${res.status}` }
}

export const AGENT_SEND_PATH = '/api/agent-send'

/** POST /api/agent-send — the ONLY way a reply reaches a customer. `messages`
 *  INSERT policies are empty, so the browser cannot write the row itself; every
 *  send funnels through hub-service so the same suppression / pause / 24h-window
 *  gate that governs the bot governs human sends too. */
export function sendAgentMessage(conversationId: string, text: string) {
  return hubFetch<{ ok: boolean }>(AGENT_SEND_PATH, {
    method: 'POST',
    body: JSON.stringify({
      conversation_id: conversationId,
      text,
      bundle_key: null,
    }),
  })
}
