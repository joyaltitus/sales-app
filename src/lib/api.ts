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

function requestHeaders(init: RequestInit, key: string, token: string): Headers {
  const headers = new Headers(init.headers)
  if (!(init.body instanceof FormData)) headers.set('content-type', 'application/json')
  headers.set('x-pm-gateway-key', key)
  headers.set('x-pm-user-jwt', token)
  return headers
}

/** Discriminated result — every hub-service failure matrix code gets a name, so
 *  the UI can say what happened rather than rendering a bare status number. */
export type HubResult<T> =
  | { kind: 'ok'; data: T }
  | { kind: 'no_key' } //        gateway key not pasted in this browser yet
  | { kind: 'no_session' } //    no Supabase session (should be impossible behind the auth gate)
  | { kind: 'unauthorized' } //  401 — bad gateway key or invalid/expired JWT
  | { kind: 'forbidden'; code?: string } // 403 — authenticated, but this role may not do this
  | { kind: 'not_found' } //     404 — conversation missing, or no resolvable send route
  | { kind: 'bad_request'; code?: string } // 400 — malformed body (a bug here, not a user error)
  | { kind: 'conflict'; code?: string } //   409 — e.g. the address is already a platform user
  | { kind: 'budget_exceeded' } // 429 — hard AI budget wall; caller offers a non-model fallback
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
      headers: requestHeaders(init, key, token),
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

  if (res.status === 401) {
    let refreshedToken: string | undefined
    try {
      const { data } = await supabase.auth.refreshSession()
      refreshedToken = data.session?.access_token
    } catch {
      /* Treat a failed refresh as an expired browser authorization. */
    }
    if (!refreshedToken) {
      return { kind: 'no_session' }
    }

    const refreshedKey = loadGatewayKey()
    if (!refreshedKey) return { kind: 'no_key' }

    try {
      res = await fetch(`${BASE}${path}`, {
        ...init,
        headers: requestHeaders(init, refreshedKey, refreshedToken),
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
  }

  // hub-service answers EVERY failure with `{ error: <code> }` (its sendFail).
  // That code is often the only thing separating two failures that share a
  // status — `role_above_caller` from a generic 403, `paused` from the other
  // 503s — so read it once here rather than leaving each caller to re-parse a
  // body that has already been consumed. AT-27 shows it to the operator
  // verbatim: hub-service is the authority on why a write was refused, and
  // rewording its answer here would be inventing a reason.
  let code: string | undefined
  try {
    code = ((await res.json()) as { error?: string }).error
  } catch {
    /* not every failure carries a JSON body */
  }

  if (res.status === 400) return { kind: 'bad_request', code }
  if (res.status === 429) return { kind: 'budget_exceeded' }
  if (res.status === 401) return { kind: 'unauthorized' }
  if (res.status === 403) return { kind: 'forbidden', code }
  if (res.status === 404) return { kind: 'not_found' }
  if (res.status === 409) return { kind: 'conflict', code }
  if (res.status === 503) {
    // 'paused' (kill-switch passive) vs 'disabled' / 'auth_unavailable' /
    // 'db_unavailable' / 'enqueue_unavailable'.
    return code === 'paused' ? { kind: 'paused' } : { kind: 'unavailable' }
  }
  return { kind: 'network', message: `HTTP ${res.status}` }
}

export const AGENT_SEND_PATH = '/api/agent-send'
export const INSIGHTS_PATH = '/api/insights'

export type Insight = {
  summary: string | null
  next_action: string
  draft_reply: string
  rationale: string | null
}

/** POST /api/insights — PM6 counsellor copilot (READ-ONLY: it returns a
 *  suggestion the human reviews; sending stays the composer's job). Same
 *  key+JWT model as agent-send; role membership enforced server-side. A 502
 *  from this path means the LLM call failed server-side (dead-lettered there),
 *  not that the network broke. */
export async function fetchInsight(
  conversationId: string,
): Promise<HubResult<Insight> | { kind: 'llm_failed' }> {
  const res = await hubFetch<{
    ok?: boolean
    summary?: string
    next_action?: string
    draft_reply?: string
    rationale?: string
  }>(INSIGHTS_PATH, {
    method: 'POST',
    body: JSON.stringify({ conversation_id: conversationId }),
  })
  if (res.kind === 'network' && res.message === 'HTTP 502') return { kind: 'llm_failed' }
  if (res.kind !== 'ok') return res
  const b = res.data
  if (!b?.ok || !b.next_action || !b.draft_reply) return { kind: 'llm_failed' }
  return {
    kind: 'ok',
    data: {
      summary: b.summary ?? null,
      next_action: b.next_action,
      draft_reply: b.draft_reply,
      rationale: b.rationale ?? null,
    },
  }
}

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
