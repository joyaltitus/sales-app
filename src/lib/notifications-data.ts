import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

// Notifications data layer (S11 SA-AUTO-01 wiring). Same conventions as
// todos-data.ts: plain PostgREST reads/writes through the anon-key client, RLS
// is the wall. `notifications` is already RLS'd to `user_id = auth.uid()`
// (migration 046), so the read cannot leak another rep's rail — the client_id
// filter is belt-and-braces for the multi-workspace switcher.
//
// Rows here are WRITTEN by hub-service's followup-nudges job (service role);
// the app only reads them and marks them read. `draft` carries the AI-suggested
// follow-up text, which the rail hands to the composer — the human still edits
// and sends. Nothing in this file sends anything.
const NOTIFICATION_LIMIT = 50

export type NotificationKindRow =
  | 'follow_up_due'
  | 'follow_up_escalation'
  | 'labeled_to_you'
  | 'needs_human'

export type NotificationRow = {
  id: string
  client_id: string
  kind: NotificationKindRow
  conversation_id: string | null
  follow_up_id: string | null
  title: string
  body: string | null
  draft: string | null
  read_at: string | null
  created_at: string
}

export type NewLeadNotification = Pick<NotificationRow, 'id' | 'title' | 'body'>

/** Bounded worker read for unread lead assignments, explicitly tenant-scoped. */
export async function readNewLeadNotifications(clientIds: string[]): Promise<NewLeadNotification[]> {
  if (clientIds.length === 0) return []
  const { data, error } = await supabase
    .from('notifications')
    .select('id, title, body')
    .in('client_id', clientIds)
    .eq('kind', 'labeled_to_you')
    .is('read_at', null)
    .limit(NOTIFICATION_LIMIT)
  if (error) throw error
  return (data ?? []) as NewLeadNotification[]
}

/** Bounded, newest-first. No infinite scroll by design (§S11 item 4). */
export function useNotifications(clientId: string | null, userId: string | null) {
  const [items, setItems] = useState<NotificationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!clientId || !userId) {
      setItems([])
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error: readError } = await supabase
      .from('notifications')
      .select(
        'id, client_id, kind, conversation_id, follow_up_id, title, body, draft, read_at, created_at',
      )
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(NOTIFICATION_LIMIT)
    if (readError) {
      setItems([])
      setError(readError.message)
      setLoading(false)
      return
    }
    setError(null)
    setItems((data ?? []) as NotificationRow[])
    setLoading(false)
  }, [clientId, userId])

  useEffect(() => {
    void load()
  }, [load])

  return { items, loading, error, reload: load }
}

/**
 * Mark rows read. Optimism lives in the caller (the rail flips the dot
 * immediately); a denied write just means RLS filtered someone else's row, and
 * an unread badge that outlives a tap is a smaller failure than a lost one.
 */
export async function markNotificationsRead(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .in('id', ids)
    .is('read_at', null)
}

/** "Now" / "18m" / "3h" / "2d" — the rail's compact stamp. */
export function shortAge(iso: string, now = Date.now()): string {
  // floor, not round: 30s old is "Now", not "1m".
  const minutes = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000))
  if (minutes < 1) return 'Now'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}
