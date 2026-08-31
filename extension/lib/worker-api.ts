import type { DueFollowUp, NewLeadNotice } from './background'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const AUTH_KEY = `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`

type WorkerSession = {
  access_token: string
  refresh_token: string
  expires_at?: number
  user: { id: string }
}

async function refreshSession(session: WorkerSession): Promise<WorkerSession | null> {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: session.refresh_token }),
  })
  if (!response.ok) return null
  const refreshed = { ...session, ...await response.json() } as WorkerSession
  await chrome.storage.local.set({ [AUTH_KEY]: JSON.stringify(refreshed) })
  return refreshed
}

export async function getWorkerSession(now = Date.now()): Promise<WorkerSession | null> {
  const stored = (await chrome.storage.local.get(AUTH_KEY))[AUTH_KEY]
  if (typeof stored !== 'string') return null
  let session: WorkerSession
  try {
    session = JSON.parse(stored) as WorkerSession
  } catch {
    return null
  }
  if (!session.access_token || !session.refresh_token || !session.user?.id) return null
  if (!session.expires_at || session.expires_at * 1000 > now + 30_000) return session
  return refreshSession(session)
}

async function rest<T>(session: WorkerSession, table: string, params: Record<string, string>): Promise<T[]> {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  const response = await fetch(url, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${session.access_token}` },
  })
  if (!response.ok) throw new Error(`Worker read failed (${response.status})`)
  return await response.json() as T[]
}

export async function readWorkerNotices(session: WorkerSession, through: string): Promise<{
  due: DueFollowUp[]
  newLeads: NewLeadNotice[]
}> {
  const memberships = await rest<{ client_id: string }>(session, 'user_client_memberships', {
    select: 'client_id',
    user_id: `eq.${session.user.id}`,
  })
  const clientIds = memberships.map((row) => row.client_id)
  if (clientIds.length === 0) return { due: [], newLeads: [] }
  const clients = `in.(${clientIds.join(',')})`
  const [due, newLeads] = await Promise.all([
    rest<DueFollowUp>(session, 'follow_ups', {
      select: 'id,note,due_at',
      client_id: clients,
      status: 'in.(pending,snoozed)',
      due_at: `lte.${through}`,
      order: 'due_at.asc',
      limit: '300',
    }),
    rest<NewLeadNotice>(session, 'notifications', {
      select: 'id,title,body',
      client_id: clients,
      kind: 'eq.labeled_to_you',
      read_at: 'is.null',
      limit: '50',
    }),
  ])
  return { due, newLeads }
}
