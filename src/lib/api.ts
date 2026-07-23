import { supabase } from './supabase'

// hub-service HTTP client (contract class W3, MASTER-PLAN §E). Bearer = the
// user's Supabase JWT; hub-service verifies signature + membership + role.
// Base URL flips at P6 cutover via VITE_HUB_API_BASE — single writer preserved.
const BASE = import.meta.env.VITE_HUB_API_BASE ?? ''

export async function hubFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  })
  if (!res.ok) {
    throw new Error(`hub ${res.status} ${path}`)
  }
  return res.json() as Promise<T>
}
