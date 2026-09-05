import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'

// Copy-once from Workbench, then owned. Driven by user_client_memberships:
// RLS lets the user read their own memberships + the clients they expose.
export type Role = 'super_admin' | 'client_admin' | 'manager' | 'agent'

export type ClientOption = {
  id: string
  name: string
  vertical: string
  role: Role
}

/** Why the membership read produced nothing. `null` means it produced a real
 *  answer — including the legitimate answer "this login is on no team". */
export type ClientLoadFailure = 'expired' | 'failed'

type ClientState = {
  clients: ClientOption[]
  activeClient: ClientOption | null
  setActiveClientId: (id: string) => void
  loading: boolean
  failure: ClientLoadFailure | null
  reload: () => void
}

const ClientContext = createContext<ClientState>({
  clients: [],
  activeClient: null,
  setActiveClientId: () => {},
  loading: true,
  failure: null,
  reload: () => {},
})

/** PostgREST answers an expired or invalid JWT with 401 + PGRST301 rather than
 *  by rejecting, so the read resolves `{ data: null, error }` and looks exactly
 *  like "no rows" unless the code is inspected. */
function isExpiredSession(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  if (error.code === 'PGRST301' || error.code === '401') return true
  return /jwt|token is expired|invalid claim/i.test(error.message ?? '')
}

const STORAGE_KEY = 'sales-app.activeClientId'

export function ClientProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const [clients, setClients] = useState<ClientOption[]>([])
  const [activeId, setActiveId] = useState<string | null>(
    localStorage.getItem(STORAGE_KEY),
  )
  const [loading, setLoading] = useState(true)
  const [failure, setFailure] = useState<ClientLoadFailure | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!session) {
      setClients([])
      setFailure(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setFailure(null)
    // The bare `.then(...)` this used to be had NO rejection path, so a fetch
    // that threw left `loading` true forever and the app painted a permanently
    // blank shell. And a clean 401 resolved with `data: null`, which the old
    // branch flattened into "no memberships" — RoleRouter then told an operator
    // with an expired token that their login was not attached to a team.
    void (async () => {
      try {
        const { data, error } = await supabase
          .from('user_client_memberships')
          .select('role, clients ( id, name, vertical )')
        if (error || !data) {
          setClients([])
          setFailure(isExpiredSession(error) ? 'expired' : 'failed')
          setLoading(false)
          return
        }
        const opts: ClientOption[] = data
          .filter((m) => (m as { clients: unknown }).clients)
          .map((m) => {
            // Supabase infers the to-one embed as an array; at runtime it's the
            // single joined row. Normalize either shape.
            const row = m as unknown as {
              role: Role
              clients: { id: string; name: string; vertical: string } | { id: string; name: string; vertical: string }[]
            }
            const c = Array.isArray(row.clients) ? row.clients[0] : row.clients
            return { id: c.id, name: c.name, vertical: c.vertical, role: row.role }
          })
          .sort((a, b) => a.name.localeCompare(b.name))
        setClients(opts)
        setLoading(false)
      } catch {
        setClients([])
        setFailure('failed')
        setLoading(false)
      }
    })()
  }, [session, attempt])

  const activeClient = clients.find((c) => c.id === activeId) ?? clients[0] ?? null

  const setActiveClientId = (id: string) => {
    setActiveId(id)
    localStorage.setItem(STORAGE_KEY, id)
  }

  return (
    <ClientContext.Provider
      value={{ clients, activeClient, setActiveClientId, loading, failure, reload: () => setAttempt((n) => n + 1) }}
    >
      {children}
    </ClientContext.Provider>
  )
}

export const useClient = () => useContext(ClientContext)
