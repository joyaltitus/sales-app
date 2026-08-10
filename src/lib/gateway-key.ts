// PM_GATEWAY_KEY holder — copied from Workbench's pattern (src/lib/gateway.ts),
// deliberately NOT reinvented (SA-01b spec: "follow Workbench's existing
// operator-pasted pattern, do not invent a new place to keep it").
//
// The key is ANTI-NOISE defence-in-depth, NOT a security wall (STATE.md). The
// real wall is Supabase JWT -> user_client_memberships -> role, enforced inside
// hub-service. Anything shipped to a browser is public, so this is not a secret.
// A configured build key serves every authenticated employee; localStorage is
// retained only as the fallback for deployments without that configuration.
const STORAGE_KEY = 'sales-app.pmGatewayKey'

export function hasConfiguredGatewayKey(): boolean {
  return Boolean(import.meta.env.VITE_PM_GATEWAY_KEY?.trim())
}

export function loadGatewayKey(): string {
  const configuredKey = import.meta.env.VITE_PM_GATEWAY_KEY?.trim()
  if (configuredKey) return configuredKey

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

export function clearGatewayKey() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* Safari private mode throws on localStorage access. */
  }
}
