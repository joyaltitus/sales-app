import { useCallback, useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { QueueItem } from './contracts'
import { panelSupabase } from './panel-client'
import { CACHE_KEYS, cacheLibrary, cacheQueue, cached, readCache } from './cache'
import { useScriptLibrary } from '@app/lib/scripts-data'

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
  const [staleAt, setStaleAt] = useState<string | null>(null)
  const request = useRef(0)

  const load = useCallback(async (showLoading = true) => {
    const generation = ++request.current
    if (showLoading) setLoading(true)
    const { data, error: readError } = await panelSupabase
      .from('rep_queue_v')
      .select('lead_id, contact_id, person_id, display_name, phone_e164, channel, stage_key, stage_label, status, owner, due_at, follow_up_id, last_activity_at, reason')
      .order('due_at', { ascending: true, nullsFirst: false })
      .limit(300)
    if (generation !== request.current) return
    if (!readError) {
      const next = (data ?? []) as QueueItem[]
      setItems(next)
      setStaleAt(null)
      await cacheQueue(cached(next, new Date(), identity.clientId))
    }
    setError(readError?.message ?? null)
    setLoading(false)
  }, [identity.clientId])

  useEffect(() => {
    let alive = true
    void readCache(CACHE_KEYS.queue).then((entry) => {
      if (!alive) return
      const usable = entry?.scope === identity.clientId
      if (usable) {
        setItems(entry.data)
        setStaleAt(entry.fetched_at)
        setLoading(false)
      }
      void load(!usable)
    })
    return () => { alive = false; request.current += 1 }
  }, [identity.clientId, identity.userId, load])
  return { items, loading, error, staleAt, reload: () => load(items.length === 0) }
}

export function useCachedScriptLibrary(clientId: string) {
  const live = useScriptLibrary(clientId)
  const [cachedScripts, setCachedScripts] = useState<typeof live.scripts | null>(null)
  const [staleAt, setStaleAt] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    void readCache(CACHE_KEYS.library).then((entry) => {
      if (alive && entry?.scope === clientId) {
        setCachedScripts(entry.data.scripts)
        setStaleAt(entry.fetched_at)
      }
    })
    return () => { alive = false }
  }, [clientId])

  useEffect(() => {
    if (live.loading || live.error) return
    setCachedScripts(null)
    setStaleAt(null)
    void cacheLibrary(cached({ scripts: live.scripts, taxonomy: live.taxonomy, rebuttals: [] }, new Date(), clientId))
  }, [clientId, live.error, live.loading, live.scripts, live.taxonomy])

  return {
    ...live,
    scripts: live.loading && cachedScripts ? cachedScripts : live.scripts,
    loading: live.loading && !cachedScripts,
    error: live.error && !cachedScripts ? live.error : null,
    staleAt: live.loading ? staleAt : null,
  }
}
