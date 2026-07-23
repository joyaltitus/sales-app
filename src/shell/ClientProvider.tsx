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

type ClientState = {
  clients: ClientOption[]
  activeClient: ClientOption | null
  setActiveClientId: (id: string) => void
  loading: boolean
}

const ClientContext = createContext<ClientState>({
  clients: [],
  activeClient: null,
  setActiveClientId: () => {},
  loading: true,
})

const STORAGE_KEY = 'sales-app.activeClientId'

export function ClientProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const [clients, setClients] = useState<ClientOption[]>([])
  const [activeId, setActiveId] = useState<string | null>(
    localStorage.getItem(STORAGE_KEY),
  )
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session) {
      setClients([])
      setLoading(false)
      return
    }
    setLoading(true)
    supabase
      .from('user_client_memberships')
      .select('role, clients ( id, name, vertical )')
      .then(({ data, error }) => {
        if (error || !data) {
          setClients([])
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
      })
  }, [session])

  const activeClient = clients.find((c) => c.id === activeId) ?? clients[0] ?? null

  const setActiveClientId = (id: string) => {
    setActiveId(id)
    localStorage.setItem(STORAGE_KEY, id)
  }

  return (
    <ClientContext.Provider
      value={{ clients, activeClient, setActiveClientId, loading }}
    >
      {children}
    </ClientContext.Provider>
  )
}

export const useClient = () => useContext(ClientContext)
