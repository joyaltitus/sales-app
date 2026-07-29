// PM_GATEWAY_KEY holder — copied from Workbench's pattern (src/lib/gateway.ts),
// deliberately NOT reinvented (SA-01b spec: "follow Workbench's existing
// operator-pasted pattern, do not invent a new place to keep it").
//
// The key is ANTI-NOISE defence-in-depth, NOT a security wall (STATE.md). The
// real wall is Supabase JWT -> user_client_memberships -> role, enforced inside
// hub-service. Anything shipped to a browser is public, so this is not a secret.
// It lives in localStorage and is never baked into the git-tracked bundle —
// rotation is "paste it again".
const STORAGE_KEY = 'sales-app.pmGatewayKey'

export function loadGatewayKey(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? ''
  } catch {
    // Safari private mode throws on localStorage access.
    return ''
  }
}

export function saveGatewayKey(value: string) {
  try {
    localStorage.setItem(STORAGE_KEY, value.trim())
  } catch {
    /* non-persistent browser; the in-memory paste still serves this session */
  }
}
