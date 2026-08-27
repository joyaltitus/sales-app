import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { QueueItem } from './contracts'
import { panelSupabase } from './panel-client'

export type PanelIdentity = { userId: string; clientId: string; displayName: string }

export async function loadPanelIdentity(session: Session): Promise<PanelIdentity | null> {
  const userId = session.user.id
  const { data: memberships, error } = await panelSupabase
    .from('user_client_memberships')
    .select('client_id')
    .eq('user_id', userId)
    .limit(1)
  if (error || !memberships?.length) return null
  const clientId = (memberships[0] as { client_id: string }).client_id
  const { data: profile } = await panelSupabase
    .from('profiles')
    .select('display_name')
    .eq('client_id', clientId)
    .eq('user_id', userId)
    .maybeSingle()
  return {
    userId,
    clientId,
    displayName: (profile as { display_name?: string } | null)?.display_name ?? session.user.email ?? 'You',
  }
}

export function useRepQueue(identity: PanelIdentity) {
  const [items, setItems] = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error: readError } = await panelSupabase
      .from('rep_queue_v')
      .select('lead_id, contact_id, person_id, display_name, phone_e164, channel, stage_key, stage_label, status, owner, due_at, follow_up_id, last_activity_at, reason')
      .order('due_at', { ascending: true, nullsFirst: false })
      .limit(300)
    setItems(readError ? [] : (data ?? []) as QueueItem[])
    setError(readError?.message ?? null)
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load, identity.clientId, identity.userId])
  return { items, loading, error, reload: load }
}
