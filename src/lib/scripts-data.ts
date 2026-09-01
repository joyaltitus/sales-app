import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

// Script serve + usage + playbook governance data layer (WIRE-A2 part 2 +
// part 3). script_versions carries its own client_id (migration 048, hard
// law 8), so every filter here is direct — no embedded-table filter needed
// for tenant scoping. The taxonomy join goes through `scripts` (a real FK).
export type ScriptStatus = 'draft' | 'testing' | 'standard'
export type ScriptParagraph = { before: string; highlight?: string; after?: string }
export type TaxonomyStatus = 'active' | 'archived'

const TAXONOMY_LIMIT = 200
const VERSION_LIMIT = 1000
const USAGE_LIMIT = 500
const PROFILE_LIMIT = 200

export type TaxonomyRow = {
  id: string
  key: string
  label: string
  aliases: string[]
  status: TaxonomyStatus
}

export type ScriptVersionSummary = {
  id: string
  scriptId: string
  version: number
  status: ScriptStatus
  headline: string | null
  body: { paragraphs: ScriptParagraph[] } | null
  changeNote: string | null
  createdBy: string
  createdByName: string | null
  createdAt: string
}

/** One taxonomy row joined with its script's full version history (client-
 *  side join: `scripts` is a real FK off `script_versions`, but Postgres
 *  doesn't have a single-hop path from `objection_taxonomy` to
 *  `script_versions`, so this does two scoped reads and joins in memory —
 *  "whichever is less code" per the wiring brief). `current` mirrors
 *  useActiveScript's own resolution (standard, else highest testing, else
 *  highest of whatever exists) so the library card and the editor agree on
 *  what's "live". */
export type LibraryScript = {
  taxonomyId: string
  taxonomyKey: string
  taxonomyLabel: string
  taxonomyStatus: TaxonomyStatus
  scriptId: string | null
  versions: ScriptVersionSummary[]
  current: ScriptVersionSummary | null
  fallback: boolean
}

function oneOfEmbed<T>(v: T | T[] | null): T | null {
  if (!v) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

/** Taxonomy list + every script's full version history for the library,
 *  editor sidebar/version-switcher, and taxonomy governance view. */
export function useScriptLibrary(clientId: string | null) {
  const [taxonomy, setTaxonomy] = useState<TaxonomyRow[]>([])
  const [scripts, setScripts] = useState<LibraryScript[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!clientId) {
      setTaxonomy([])
      setScripts([])
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const [taxRes, verRes, profilesRes] = await Promise.all([
      supabase
        .from('objection_taxonomy')
        .select('id, key, label, aliases, status')
        .eq('client_id', clientId)
        .order('label', { ascending: true })
        .limit(TAXONOMY_LIMIT),
      supabase
        .from('script_versions')
        .select(
          'id, script_id, version, status, headline, body, change_note, created_by, created_at, scripts!script_versions_script_id_fkey!inner(id, taxonomy_id)',
        )
        .eq('client_id', clientId)
        .order('version', { ascending: false })
        .limit(VERSION_LIMIT),
      supabase.from('profiles').select('user_id, display_name').eq('client_id', clientId).limit(PROFILE_LIMIT),
    ])

    if (taxRes.error) {
      setError(taxRes.error.message)
      setLoading(false)
      return
    }
    if (verRes.error) {
      setError(verRes.error.message)
      setLoading(false)
      return
    }
    setError(null)

    const nameByUser = new Map(
      ((profilesRes.data ?? []) as { user_id: string; display_name: string }[]).map((p) => [p.user_id, p.display_name]),
    )
    const taxRows = (taxRes.data ?? []) as TaxonomyRow[]
    setTaxonomy(taxRows)

    const verRows = (verRes.data ?? []) as unknown as {
      id: string
      script_id: string
      version: number
      status: ScriptStatus
      headline: string | null
      body: { paragraphs: ScriptParagraph[] } | null
      change_note: string | null
      created_by: string
      created_at: string
      scripts: { id: string; taxonomy_id: string } | { id: string; taxonomy_id: string }[] | null
    }[]

    const taxonomyByScriptId = new Map<string, string>()
    for (const v of verRows) {
      const s = oneOfEmbed(v.scripts)
      if (s) taxonomyByScriptId.set(v.script_id, s.taxonomy_id)
    }
    const versionsByTaxonomy = new Map<string, ScriptVersionSummary[]>()
    for (const v of verRows) {
      const taxonomyId = taxonomyByScriptId.get(v.script_id)
      if (!taxonomyId) continue
      const summary: ScriptVersionSummary = {
        id: v.id,
        scriptId: v.script_id,
        version: v.version,
        status: v.status,
        headline: v.headline,
        body: v.body,
        changeNote: v.change_note,
        createdBy: v.created_by,
        createdByName: nameByUser.get(v.created_by) ?? null,
        createdAt: v.created_at,
      }
      const list = versionsByTaxonomy.get(taxonomyId) ?? []
      list.push(summary)
      versionsByTaxonomy.set(taxonomyId, list)
    }

    setScripts(
      taxRows.map((t) => {
        const versions = (versionsByTaxonomy.get(t.id) ?? []).sort((a, b) => b.version - a.version)
        const standard = versions.find((v) => v.status === 'standard')
        const current = standard ?? versions.find((v) => v.status === 'testing') ?? versions[0] ?? null
        return {
          taxonomyId: t.id,
          taxonomyKey: t.key,
          taxonomyLabel: t.label,
          taxonomyStatus: t.status,
          scriptId: versions[0]?.scriptId ?? null,
          versions,
          current,
          fallback: !standard && !!current,
        }
      }),
    )
    setLoading(false)
  }, [clientId])

  useEffect(() => {
    void load()
  }, [load])

  return { taxonomy, scripts, loading, error, reload: load }
}

/** Bounded aggregate: usage rows for the client, counted client-side per
 *  script_version_id. v1 per the wiring brief — a server-side aggregate is
 *  backlog if the 500-row bound ever proves too small. */
export function useScriptUsageCounts(clientId: string | null) {
  const [counts, setCounts] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!clientId) {
      setCounts(new Map())
      setLoading(false)
      return
    }
    setLoading(true)
    const { data } = await supabase
      .from('script_usage')
      .select('script_version_id')
      .eq('client_id', clientId)
      .limit(USAGE_LIMIT)
    const map = new Map<string, number>()
    for (const row of (data ?? []) as { script_version_id: string }[]) {
      map.set(row.script_version_id, (map.get(row.script_version_id) ?? 0) + 1)
    }
    setCounts(map)
    setLoading(false)
  }, [clientId])

  useEffect(() => {
    void load()
  }, [load])

  return { counts, loading, reload: load }
}

/** Get-or-create the one `scripts` row for (client, taxonomy) — UNIQUE
 *  constraint means a taxonomy tag with no authored script yet has no
 *  `scripts` row at all. The editor needs this before its first draft
 *  insert. Manager/client_admin only (RLS), same as createDraftVersion. */
export async function ensureScript(
  clientId: string,
  taxonomyId: string,
  createdBy: string,
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const { data: existing, error: selectError } = await supabase
    .from('scripts')
    .select('id')
    .eq('client_id', clientId)
    .eq('taxonomy_id', taxonomyId)
    .maybeSingle()
  if (selectError) return { ok: false, message: selectError.message }
  if (existing) return { ok: true, id: (existing as { id: string }).id }

  const { data, error } = await supabase
    .from('scripts')
    .insert({ client_id: clientId, taxonomy_id: taxonomyId, created_by: createdBy })
    .select('id')
    .single()
  if (error) return { ok: false, message: error.message }
  return { ok: true, id: (data as { id: string }).id }
}

/** The editor's autosave path: a plain insert, version = current max + 1.
 *  Rows are immutable after this (status is the only mutable column, and
 *  only via pm_promote_script_version) — see promoteScriptVersion below. */
export async function createDraftVersion({
  clientId,
  scriptId,
  headline,
  body,
  changeNote,
  createdBy,
  status = 'draft',
}: {
  clientId: string
  scriptId: string
  headline: string | null
  body: { paragraphs: ScriptParagraph[] }
  changeNote?: string | null
  createdBy: string
  status?: 'draft' | 'testing'
}): Promise<{ ok: true; id: string; version: number } | { ok: false; message: string }> {
  const { data: maxRow, error: maxError } = await supabase
    .from('script_versions')
    .select('version')
    .eq('client_id', clientId)
    .eq('script_id', scriptId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (maxError) return { ok: false, message: maxError.message }
  const nextVersion = ((maxRow as { version: number } | null)?.version ?? 0) + 1

  const { data, error } = await supabase
    .from('script_versions')
    .insert({
      client_id: clientId,
      script_id: scriptId,
      version: nextVersion,
      status,
      headline,
      body,
      change_note: changeNote ?? null,
      created_by: createdBy,
    })
    .select('id')
    .single()
  if (error) return { ok: false, message: error.message }
  return { ok: true, id: (data as { id: string }).id, version: nextVersion }
}

/** Wraps pm_promote_script_version (migration 048). Surfaces the RPC's raised
 *  error message as-is — a non-manager caller gets a 42501 raise that the UI
 *  must show verbatim (AT-04), never reworded into a generic toast. */
export async function promoteScriptVersion(
  scriptId: string,
  versionId: string,
  expectedActiveVersionId: string | null,
): Promise<
  | { ok: true; promotedVersionId: string; demotedVersionId: string | null }
  | { ok: false; message: string }
> {
  const { data, error } = await supabase.rpc('pm_promote_script_version', {
    p_script_id: scriptId,
    p_version_id: versionId,
    p_expected_active_version_id: expectedActiveVersionId,
  })
  if (error) return { ok: false, message: error.message }
  const row = (Array.isArray(data) ? data[0] : data) as
    | { promoted_version_id: string; demoted_version_id: string | null }
    | undefined
  if (!row) return { ok: false, message: 'pm_promote_script_version returned no row' }
  return { ok: true, promotedVersionId: row.promoted_version_id, demotedVersionId: row.demoted_version_id }
}

/** Slug a free-typed label into a taxonomy key. Collisions surface as the
 *  DB's own error (whatever uniqueness it enforces) — not pre-checked here. */
export function slugifyTaxonomyKey(label: string): string {
  return (
    label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'custom'
  )
}

export async function createTaxonomy(
  clientId: string,
  label: string,
  createdBy: string,
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const { data, error } = await supabase
    .from('objection_taxonomy')
    .insert({ client_id: clientId, key: slugifyTaxonomyKey(label), label: label.trim(), created_by: createdBy })
    .select('id')
    .single()
  if (error) return { ok: false, message: error.message }
  return { ok: true, id: (data as { id: string }).id }
}

export async function renameTaxonomy(
  clientId: string,
  id: string,
  label: string,
): Promise<{ ok: true } | { ok: false; reason: 'denied' | 'error'; message?: string }> {
  const { data, error } = await supabase
    .from('objection_taxonomy')
    .update({ label: label.trim() })
    .eq('client_id', clientId)
    .eq('id', id)
    .select('id')
  if (error) return { ok: false, reason: 'error', message: error.message }
  if (!data || data.length === 0) return { ok: false, reason: 'denied' }
  return { ok: true }
}

/** No DELETE policy exists (hard law: archiving is UPDATE status only). Same
 *  function flips either direction — archive or restore. */
export async function archiveTaxonomy(
  clientId: string,
  id: string,
  status: TaxonomyStatus,
): Promise<{ ok: true } | { ok: false; reason: 'denied' | 'error'; message?: string }> {
  const { data, error } = await supabase
    .from('objection_taxonomy')
    .update({ status })
    .eq('client_id', clientId)
    .eq('id', id)
    .select('id')
  if (error) return { ok: false, reason: 'error', message: error.message }
  if (!data || data.length === 0) return { ok: false, reason: 'denied' }
  return { ok: true }
}

export type ActiveScript = {
  scriptId: string
  versionId: string
  version: number
  status: ScriptStatus
  headline: string | null
  paragraphs: ScriptParagraph[]
  /** true when there is no 'standard' and this is the highest-version 'testing' fallback */
  fallback: boolean
}

/** The version the UI should show for an objection: the live 'standard', else
 *  the highest-version 'testing' (flagged fallback), else null (a gap). */
export function useActiveScript(clientId: string | null, taxonomyId: string | null) {
  const [script, setScript] = useState<ActiveScript | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!clientId || !taxonomyId) {
      setScript(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from('script_versions')
      .select('id, script_id, version, status, headline, body, scripts!script_versions_script_id_fkey!inner(taxonomy_id)')
      .eq('client_id', clientId)
      .eq('scripts.taxonomy_id', taxonomyId)
      .in('status', ['standard', 'testing'])
      .order('version', { ascending: false })

    if (error || !data || data.length === 0) {
      setScript(null)
      setLoading(false)
      return
    }
    const rows = data as unknown as {
      id: string
      script_id: string
      version: number
      status: ScriptStatus
      headline: string | null
      body: { paragraphs: ScriptParagraph[] } | null
    }[]
    const standard = rows.find((r) => r.status === 'standard')
    const chosen = standard ?? rows[0]
    setScript({
      scriptId: chosen.script_id,
      versionId: chosen.id,
      version: chosen.version,
      status: chosen.status,
      headline: chosen.headline,
      paragraphs: chosen.body?.paragraphs ?? [],
      fallback: !standard,
    })
    setLoading(false)
  }, [clientId, taxonomyId])

  useEffect(() => {
    void load()
  }, [load])

  return { script, loading, reload: load }
}

/** Insert-as-draft usage row when a script is inserted into the composer. */
export async function insertScriptUsage({
  clientId,
  scriptVersionId,
  objectionLogId,
  conversationId,
  actorId,
  insertedAsDraft = true,
}: {
  clientId: string
  scriptVersionId: string
  objectionLogId?: string | null
  conversationId?: string | null
  actorId: string
  insertedAsDraft?: boolean
}): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const { data, error } = await supabase
    .from('script_usage')
    .insert({
      client_id: clientId,
      script_version_id: scriptVersionId,
      objection_log_id: objectionLogId ?? null,
      conversation_id: conversationId ?? null,
      actor_id: actorId,
      inserted_as_draft: insertedAsDraft,
    })
    .select('id')
    .single()
  if (error) return { ok: false, message: error.message }
  return { ok: true, id: (data as { id: string }).id }
}

/** Worked/Didn't tap — actor-own only (script_usage_update policy has no
 *  manager override, deliberately: this is the rep's own signal). */
export async function updateScriptUsageFeedback(
  clientId: string,
  usageId: string,
  feedback: 'worked' | 'didnt_work',
): Promise<{ ok: true } | { ok: false; reason: 'denied' | 'error'; message?: string }> {
  const { data, error } = await supabase
    .from('script_usage')
    .update({ feedback, feedback_at: new Date().toISOString() })
    .eq('client_id', clientId)
    .eq('id', usageId)
    .select('id')
  if (error) return { ok: false, reason: 'error', message: error.message }
  if (!data || data.length === 0) return { ok: false, reason: 'denied' }
  return { ok: true }
}

/** No standard script exists for the objection — flag it. One open gap per
 *  (client, taxonomy): uq_playbook_gaps_one_open is the arbiter, and a plain
 *  insert's 23505 on that partial unique is the expected "already flagged"
 *  path, not a real error. */
export async function insertPlaybookGap({
  clientId,
  taxonomyId,
  objectionLogId,
  exactCustomerWords,
  createdBy,
}: {
  clientId: string
  taxonomyId: string
  objectionLogId?: string | null
  exactCustomerWords?: string | null
  createdBy: string
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.from('playbook_gaps').insert({
    client_id: clientId,
    taxonomy_id: taxonomyId,
    objection_log_id: objectionLogId ?? null,
    exact_customer_words: exactCustomerWords ?? null,
    created_by: createdBy,
  })
  if (error) {
    if (error.code === '23505') return { ok: true }
    return { ok: false, message: error.message }
  }
  return { ok: true }
}
