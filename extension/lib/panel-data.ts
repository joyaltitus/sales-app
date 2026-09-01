import { useCallback, useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { QueueItem } from './contracts'
import { panelSupabase } from './panel-client'
import { CACHE_KEYS, cacheLibrary, cacheQueue, cached, readCache } from './cache'
import { useScriptLibrary } from '@app/lib/scripts-data'
import { loadPrefs } from './prefs'

export type PanelIdentity = { userId: string; clientId: string; displayName: string }
const QUEUE_PAGE_SIZE = 50

export async function loadPanelIdentity(session: Session): Promise<PanelIdentity | null> {
  const userId = session.user.id
  // No .limit(1): a rep in several workspaces gets the one they chose in the
  // options page. Limiting the read first would make the choice unreachable
  // whenever the wanted membership was not the row Postgres happened to return.
  const { data: memberships, error } = await panelSupabase
    .from('user_client_memberships')
    .select('client_id')
    .eq('user_id', userId)
  if (error || !memberships?.length) return null
  const rows = memberships as { client_id: string }[]
  const preferred = (await loadPrefs()).activeClientId
  const clientId = rows.find((row) => row.client_id === preferred)?.client_id
    ?? (rows[0] as { client_id: string }).client_id
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

export function useRepQueue(identity: PanelIdentity, since: string | null = null) {
  const [items, setItems] = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [staleAt, setStaleAt] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const request = useRef(0)

  const load = useCallback(async (search: string, offset = 0, showLoading = true) => {
    // `since` filters on the view's own last_activity_at rather than in the
    // browser: paging 50 at a time means a client-side date filter would hide
    // rows that simply had not been fetched yet, and quietly report a wrong count.
    const generation = ++request.current
    if (showLoading) setLoading(true)
    setSearching(true)
    const term = search.trim().replace(/[,%()]/g, '')
    let dbQuery = panelSupabase
      .from('rep_queue_v')
      .select('lead_id, contact_id, person_id, display_name, phone_e164, channel, stage_key, stage_label, status, owner, due_at, follow_up_id, last_activity_at, reason')
      .order('due_at', { ascending: true, nullsFirst: false })
    if (term) dbQuery = dbQuery.or(`display_name.ilike.%${term}%,phone_e164.ilike.%${term}%`)
    if (since) dbQuery = dbQuery.gte('last_activity_at', since)
    const { data, error: readError } = await dbQuery.range(offset, offset + QUEUE_PAGE_SIZE - 1)
    if (generation !== request.current) return
    if (!readError) {
      const next = (data ?? []) as QueueItem[]
      setItems((current) => offset ? [...current, ...next] : next)
      setHasMore(next.length === QUEUE_PAGE_SIZE)
      setStaleAt(null)
      // Only the UNFILTERED first page is cached: caching a narrowed result
      // would make the next cold open look like the rep's whole book had shrunk.
      if (!term && !since && offset === 0) await cacheQueue(cached(next, new Date(), identity.clientId))
    }
    setError(readError?.message ?? null)
    setLoading(false)
    setSearching(false)
  }, [identity.clientId, since])

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
      void load('', 0, !usable)
    })
    return () => { alive = false; request.current += 1 }
  }, [identity.clientId, identity.userId, load])

  const search = useCallback((next: string) => {
    setQuery(next)
    void load(next, 0, false)
  }, [load])
  const loadMore = useCallback(() => { void load(query, items.length, false) }, [items.length, load, query])
  return {
    items, loading, error, staleAt, searching, hasMore, search, loadMore,
    reload: () => load(query, 0, items.length === 0),
  }
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
    scripts: (live.loading || live.error) && cachedScripts ? cachedScripts : live.scripts,
    loading: live.loading && !cachedScripts,
    error: live.error && !cachedScripts ? live.error : null,
    staleAt: (live.loading || live.error) && cachedScripts ? staleAt : null,
  }
}
