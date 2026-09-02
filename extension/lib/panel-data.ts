import { useCallback, useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import type {
  CourseItem, PersonalSpin, PlaybookKind, PlaybookLibrary, QueueItem, Rebuttal, SalesConfig, ScriptBody,
} from './contracts'
import { panelSupabase } from './panel-client'
import { CACHE_KEYS, cacheLibrary, cacheQueue, cached, readCache } from './cache'
import { bodyLangs } from './script-text'
import { loadPrefs } from './prefs'

export type PanelIdentity = {
  userId: string
  clientId: string
  displayName: string
  /** {{client.name}} — the academy, as the customer knows it. */
  clientName: string
  /** From the membership: 'agent' | 'manager' | 'client_admin'. Gates the
   *  Sales Hub edit link, nothing else — RLS is the real boundary. */
  role: string
  /** clients.timezone; every callback time the rep confirms is stated in it. */
  timezone: string
}

const QUEUE_PAGE_SIZE = 50
const DEFAULT_TZ = 'Asia/Kolkata'

export async function loadPanelIdentity(session: Session): Promise<PanelIdentity | null> {
  const userId = session.user.id
  // No .limit(1): a rep in several workspaces gets the one they chose in the
  // options page. Limiting the read first would make the choice unreachable
  // whenever the wanted membership was not the row Postgres happened to return.
  const { data: memberships, error } = await panelSupabase
    .from('user_client_memberships')
    .select('client_id, role')
    .eq('user_id', userId)
  if (error || !memberships?.length) return null
  const rows = memberships as { client_id: string; role?: string }[]
  const preferred = (await loadPrefs()).activeClientId
  const membership = rows.find((row) => row.client_id === preferred) ?? rows[0]!
  const clientId = membership.client_id
  const [{ data: profile }, { data: client }] = await Promise.all([
    panelSupabase.from('profiles').select('display_name').eq('client_id', clientId).eq('user_id', userId).maybeSingle(),
    panelSupabase.from('clients').select('name, timezone').eq('id', clientId).maybeSingle(),
  ])
  const clientRow = client as { name?: string; timezone?: string } | null
  return {
    userId,
    clientId,
    displayName: (profile as { display_name?: string } | null)?.display_name ?? session.user.email ?? 'You',
    clientName: clientRow?.name ?? 'us',
    role: membership.role ?? 'agent',
    timezone: clientRow?.timezone || DEFAULT_TZ,
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

// ── The playbook library ─────────────────────────────────────────────────────

const TAXONOMY_LIMIT = 200
const VERSION_LIMIT = 1000
const ITEM_LIMIT = 200
const SPIN_LIMIT = 200

type TaxonomyRow = {
  id: string; key: string; label: string; kind?: PlaybookKind | null
  position?: number | null; icon?: string | null; status?: 'active' | 'archived' | null
}
type VersionRow = {
  id: string; script_id: string; version: number; status: string; headline: string | null
  body: ScriptBody | null; created_at: string
  scripts: { id: string; taxonomy_id: string } | { id: string; taxonomy_id: string }[] | null
}
type WinRow = { script_version_id: string; uses: number | null; rated: number | null; won: number | null }
type SpinRow = { id: string; script_id: string; lang: string; title: string | null; body: string; updated_at: string }

function oneOfEmbed<T>(value: T | T[] | null): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

/**
 * Taxonomy + versions + win rates + spins, joined in memory.
 *
 * `useScriptLibrary` in src/lib does the same join but selects neither
 * kind/position/icon nor the win-rate view nor the rep's own spins, and the
 * panel needs all three in ONE payload it can cache. Same resolution rule as
 * useActiveScript (standard, else highest testing, else highest) so the panel
 * and the hub never disagree about what is live.
 * // dedupe-after-PLAY-A: fold back into src/lib/scripts-data.ts once that file
 * // carries the migration-068 columns.
 */
export function composeLibrary(input: {
  taxonomy: TaxonomyRow[]
  versions: VersionRow[]
  winRates: WinRow[]
  courses: CourseItem[]
  config: SalesConfig | null
  spins: SpinRow[]
}): PlaybookLibrary {
  const taxonomyByScript = new Map<string, string>()
  for (const version of input.versions) {
    const script = oneOfEmbed(version.scripts)
    if (script) taxonomyByScript.set(version.script_id, script.taxonomy_id)
  }
  const versionsByTaxonomy = new Map<string, VersionRow[]>()
  for (const version of input.versions) {
    const taxonomyId = taxonomyByScript.get(version.script_id)
    if (!taxonomyId) continue
    const list = versionsByTaxonomy.get(taxonomyId) ?? []
    list.push(version)
    versionsByTaxonomy.set(taxonomyId, list)
  }
  const winByVersion = new Map(input.winRates.map((row) => [row.script_version_id, row]))
  const spinsByScript = new Map<string, SpinRow[]>()
  for (const spin of input.spins) {
    const list = spinsByScript.get(spin.script_id) ?? []
    list.push(spin)
    spinsByScript.set(spin.script_id, list)
  }

  const scripts = input.taxonomy.map((row): Rebuttal => {
    const versions = (versionsByTaxonomy.get(row.id) ?? []).sort((a, b) => b.version - a.version)
    const current = versions.find((v) => v.status === 'standard')
      ?? versions.find((v) => v.status === 'testing')
      ?? versions[0]
      ?? null
    const win = current ? winByVersion.get(current.id) : undefined
    const scriptId = current?.script_id ?? null
    // One spin per (script, lang); the HUD picks the dialect it needs. The
    // freshest stands in when a script has spins in several dialects.
    const spins = scriptId ? (spinsByScript.get(scriptId) ?? []) : []
    const spin = [...spins].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0]
    return {
      taxonomy_id: row.id,
      taxonomy_key: row.key,
      label: row.label,
      kind: row.kind === 'stage' ? 'stage' : 'objection',
      position: typeof row.position === 'number' ? row.position : 0,
      icon: row.icon ?? null,
      status: row.status === 'archived' ? 'archived' : 'active',
      script_id: scriptId,
      script_version_id: current?.id ?? null,
      version: current?.version ?? null,
      created_at: current?.created_at ?? null,
      headline: current?.headline ?? null,
      body: current?.body ?? null,
      langs: bodyLangs(current?.body),
      uses: win?.uses ?? 0,
      rated: win?.rated ?? 0,
      won: win?.won ?? 0,
      spin: spin ? spinOf(spin) : null,
    }
  })
  return { scripts, courses: input.courses, config: input.config, spins: input.spins.map(spinOf) }
}

function spinOf(row: SpinRow): PersonalSpin {
  return {
    id: row.id,
    script_id: row.script_id,
    lang: row.lang,
    title: row.title ?? '',
    body: row.body,
    updated_at: row.updated_at,
  }
}

/** Every spin the rep owns for one script, keyed by dialect. */
export function spinsFor(spins: readonly PersonalSpin[], scriptId: string | null): Map<string, PersonalSpin> {
  const map = new Map<string, PersonalSpin>()
  if (!scriptId) return map
  for (const spin of spins) if (spin.script_id === scriptId) map.set(spin.lang, spin)
  return map
}

const EMPTY_LIBRARY: PlaybookLibrary = { scripts: [], courses: [], config: null, spins: [] }

/**
 * The one library read, cache-first.
 *
 * Offline the panel serves the cached payload and flags it with staleAt —
 * unchanged StaleChip semantics: a stale answer beats a spinner in front of a
 * customer, as long as it says it is stale.
 */
export function usePlaybookLibrary(clientId: string, userId: string) {
  const [data, setData] = useState<PlaybookLibrary>(EMPTY_LIBRARY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [staleAt, setStaleAt] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [taxRes, verRes, winRes, itemRes, clientRes, spinRes] = await Promise.all([
      panelSupabase.from('objection_taxonomy')
        .select('id, key, label, kind, position, icon, status')
        .eq('client_id', clientId).order('position', { ascending: true }).limit(TAXONOMY_LIMIT),
      panelSupabase.from('script_versions')
        .select('id, script_id, version, status, headline, body, created_at, scripts!script_versions_script_id_fkey!inner(id, taxonomy_id)')
        .eq('client_id', clientId).order('version', { ascending: false }).limit(VERSION_LIMIT),
      panelSupabase.from('script_win_rates_v').select('script_version_id, uses, rated, won').eq('client_id', clientId),
      panelSupabase.from('items').select('id, name, category, active, sales_facts').eq('client_id', clientId).limit(ITEM_LIMIT),
      panelSupabase.from('clients').select('sales_config').eq('id', clientId).maybeSingle(),
      panelSupabase.from('quick_replies').select('id, script_id, lang, title, body, updated_at')
        .eq('client_id', clientId).eq('scope', 'personal').eq('created_by', userId).limit(SPIN_LIMIT),
    ])
    // Taxonomy and versions are the playbook; the rest are decoration that must
    // not blank the panel when a view or a column is not there yet.
    if (taxRes.error || verRes.error) {
      setError((taxRes.error ?? verRes.error)!.message)
      setLoading(false)
      return
    }
    const spinRows = (spinRes.data ?? []) as SpinRow[]
    const next = composeLibrary({
      taxonomy: (taxRes.data ?? []) as TaxonomyRow[],
      versions: (verRes.data ?? []) as unknown as VersionRow[],
      winRates: (winRes.data ?? []) as WinRow[],
      courses: (itemRes.data ?? []) as CourseItem[],
      config: ((clientRes.data as { sales_config?: SalesConfig } | null)?.sales_config ?? null),
      spins: spinRows,
    })
    setData(next)
    setError(null)
    setStaleAt(null)
    setLoading(false)
    await cacheLibrary(cached(next, new Date(), clientId))
  }, [clientId, userId])

  useEffect(() => {
    let alive = true
    void readCache(CACHE_KEYS.library).then((entry) => {
      if (!alive) return
      if (entry?.scope === clientId) {
        setData(entry.data)
        setStaleAt(entry.fetched_at)
        setLoading(false)
      }
      void load()
    })
    return () => { alive = false }
  }, [clientId, load])

  // A cached payload on screen outranks the error that failed to replace it:
  // the rep gets the scripts plus a "cached N min ago" chip, not a red box.
  return { ...data, loading, error: staleAt ? null : error, staleAt, reload: load }
}
