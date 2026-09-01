import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { ScriptBody } from './script-body'

// Tenant sales settings, course facts, per-rep personal spin and the weekly
// teardown read (migration 068).
//
// Two of these writes are RPC-only by design: clients.sales_config and
// items.sales_facts are guarded by pm_set_sales_config / pm_set_item_sales_facts
// (SECURITY DEFINER with their own manager|client_admin wall) so that a manager
// can edit them WITHOUT widening clients_write (super_admin) or items_write
// (client_admin). A rep calling either gets 42501, which every caller here maps
// to "Managers only" rather than showing a raw Postgres string.

const COURSE_LIMIT = 100
const SPIN_LIMIT = 300
const TEARDOWN_LIMIT = 500

/** Every error path in this module returns this shape — never a throw, never a
 *  bare boolean. The UI needs the sentence to put in front of the manager. */
export type WriteResult = { ok: true } | { ok: false; message: string }

const DENIED = 'Managers only — ask an admin to change this.'

/** 42501 is the wall both RPCs raise, and what RLS raises for a rep. Postgres
 *  sends it as `code` on the PostgrestError; older supabase-js surfaces it only
 *  in the message, so both are checked. */
function messageFor(error: { code?: string | null; message?: string | null } | null): string {
  if (!error) return 'That did not save.'
  if (error.code === '42501' || /permission denied|requires manager|row-level security/i.test(error.message ?? '')) {
    return DENIED
  }
  return error.message || 'That did not save.'
}

// ---------------------------------------------------------------- sales config

export type SalesConfig = {
  languages: string[]
  defaultLang: string
  upiVpa: string
  upiPayee: string
  payUrl: string
  tokenAmount: number
  tokenNote: string
}

/** Safe defaults matter more than usual here: this drives which dialect tabs
 *  exist and what the seat-reservation text says. A tenant that has never
 *  opened the Settings tab still gets a working English playbook. */
export const SALES_CONFIG_DEFAULTS: SalesConfig = {
  languages: ['en'],
  defaultLang: 'en',
  upiVpa: '',
  upiPayee: '',
  payUrl: '',
  tokenAmount: 500,
  tokenNote: '',
}

type SalesConfigJson = {
  languages?: unknown
  default_lang?: unknown
  upi_vpa?: unknown
  upi_payee?: unknown
  pay_url?: unknown
  token_amount?: unknown
  token_note?: unknown
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

export function parseSalesConfig(raw: unknown): SalesConfig {
  const json = (raw ?? {}) as SalesConfigJson
  const languages = Array.isArray(json.languages)
    ? json.languages.filter((l): l is string => typeof l === 'string' && l.length > 0)
    : []
  // 'en' is always offered: every script's base body is written in it, so a
  // tenant that removes it would strand its own fallback.
  const withEn = languages.includes('en') ? languages : ['en', ...languages]
  const amount = Number(json.token_amount)
  return {
    languages: withEn.length ? withEn : SALES_CONFIG_DEFAULTS.languages,
    defaultLang: str(json.default_lang, SALES_CONFIG_DEFAULTS.defaultLang),
    upiVpa: str(json.upi_vpa),
    upiPayee: str(json.upi_payee),
    payUrl: str(json.pay_url),
    tokenAmount: Number.isFinite(amount) && amount > 0 ? Math.round(amount) : SALES_CONFIG_DEFAULTS.tokenAmount,
    tokenNote: str(json.token_note),
  }
}

/** Camel patch → the snake_case jsonb the RPC shallow-merges. Only the keys
 *  present are sent, because pm_set_sales_config merges (`||`) rather than
 *  replaces — sending a whole object would silently clobber a key added later
 *  by another surface. */
export function toSalesConfigJson(patch: Partial<SalesConfig>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (patch.languages !== undefined) out.languages = patch.languages
  if (patch.defaultLang !== undefined) out.default_lang = patch.defaultLang
  if (patch.upiVpa !== undefined) out.upi_vpa = patch.upiVpa
  if (patch.upiPayee !== undefined) out.upi_payee = patch.upiPayee
  if (patch.payUrl !== undefined) out.pay_url = patch.payUrl
  if (patch.tokenAmount !== undefined) out.token_amount = patch.tokenAmount
  if (patch.tokenNote !== undefined) out.token_note = patch.tokenNote
  return out
}

export function useSalesConfig(clientId: string | null) {
  const [config, setConfig] = useState<SalesConfig>(SALES_CONFIG_DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!clientId) {
      setConfig(SALES_CONFIG_DEFAULTS)
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error: readError } = await supabase
      .from('clients')
      .select('sales_config')
      .eq('id', clientId)
      .maybeSingle()
    setError(readError ? readError.message : null)
    setConfig(parseSalesConfig((data as { sales_config?: unknown } | null)?.sales_config))
    setLoading(false)
  }, [clientId])

  useEffect(() => {
    void load()
  }, [load])

  // setConfig is exposed so the Settings tab can apply optimistically and roll
  // back to the previous value when the RPC refuses.
  return { config, loading, error, reload: load, setConfig }
}

export async function setSalesConfig(clientId: string, patch: Partial<SalesConfig>): Promise<WriteResult> {
  const { error } = await supabase.rpc('pm_set_sales_config', {
    p_client_id: clientId,
    p_config: toSalesConfigJson(patch),
  })
  if (error) return { ok: false, message: messageFor(error) }
  return { ok: true }
}

// -------------------------------------------------------------------- courses

export type Course = {
  id: string
  name: string
  slug: string
  price: number | null
  facts: Record<string, unknown>
}

/** The fact keys the seeded scripts merge from. Data, not schema (hard law 3):
 *  this list only drives the FORM — a tenant may store any key it likes, and
 *  anything extra is preserved by setItemSalesFacts's read-modify-write. */
export const COURSE_FACT_KEYS = [
  'fee',
  'emi_monthly',
  'emi_months',
  'duration',
  'batch_start',
  'usp',
  'proof',
  'token_amount',
] as const

export function useCourses(clientId: string | null) {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!clientId) {
      setCourses([])
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error: readError } = await supabase
      .from('items')
      .select('id, name, slug, price, sales_facts')
      .eq('client_id', clientId)
      .eq('active', true)
      .order('name', { ascending: true })
      .limit(COURSE_LIMIT)
    setError(readError ? readError.message : null)
    setCourses(
      ((data ?? []) as { id: string; name: string; slug: string; price: number | null; sales_facts: unknown }[]).map(
        (row) => ({
          id: row.id,
          name: row.name,
          slug: row.slug,
          price: row.price,
          facts: (row.sales_facts ?? {}) as Record<string, unknown>,
        }),
      ),
    )
    setLoading(false)
  }, [clientId])

  useEffect(() => {
    void load()
  }, [load])

  return { courses, loading, error, reload: load }
}

/** pm_set_item_sales_facts REPLACES sales_facts — it is not a merge like the
 *  sales_config RPC. Callers must therefore send the WHOLE object; the Courses
 *  form does, by editing a copy of the row it read. */
export async function setItemSalesFacts(itemId: string, facts: Record<string, unknown>): Promise<WriteResult> {
  const { error } = await supabase.rpc('pm_set_item_sales_facts', { p_item_id: itemId, p_facts: facts })
  if (error) return { ok: false, message: messageFor(error) }
  return { ok: true }
}

// --------------------------------------------------------------- personal spin

/** A rep's own wording for one standard script, in one dialect. Stored as a
 *  personal quick_reply pinned to the script (068): reps already own insert/
 *  update/delete on their own quick_replies rows, so this needs no new policy
 *  and the spin shows up in the composer's snippet picker for free. */
export type Spin = {
  id: string
  scriptId: string
  lang: string
  title: string
  body: string
  updatedAt: string
}

export const SPIN_MAX_CHARS = 1500

export function useSpins(clientId: string | null, userId: string | null) {
  const [spins, setSpins] = useState<Spin[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!clientId || !userId) {
      setSpins([])
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error: readError } = await supabase
      .from('quick_replies')
      .select('id, script_id, lang, title, body, updated_at')
      .eq('client_id', clientId)
      .eq('created_by', userId)
      .eq('scope', 'personal')
      .eq('active', true)
      .not('script_id', 'is', null)
      .limit(SPIN_LIMIT)
    setError(readError ? readError.message : null)
    setSpins(
      (
        (data ?? []) as {
          id: string
          script_id: string
          lang: string | null
          title: string
          body: string
          updated_at: string
        }[]
      ).map((row) => ({
        id: row.id,
        scriptId: row.script_id,
        lang: row.lang ?? 'en',
        title: row.title,
        body: row.body,
        updatedAt: row.updated_at,
      })),
    )
    setLoading(false)
  }, [clientId, userId])

  useEffect(() => {
    void load()
  }, [load])

  return { spins, loading, error, reload: load }
}

/** Insert, or update the existing row for (client, rep, script, lang). The
 *  unique index uq_quick_replies_personal_spin is the real arbiter, so this
 *  looks first and falls back to an update on 23505 rather than trusting the
 *  read — two tabs open on the same script is a normal Tuesday. */
export async function upsertSpin({
  clientId,
  userId,
  scriptId,
  lang,
  title,
  body,
}: {
  clientId: string
  userId: string
  scriptId: string
  lang: string
  title: string
  body: string
}): Promise<WriteResult> {
  const trimmed = body.trim()
  if (!trimmed) return { ok: false, message: 'Write your version first.' }
  if (trimmed.length > SPIN_MAX_CHARS) {
    return { ok: false, message: `Keep it under ${SPIN_MAX_CHARS} characters — yours is ${trimmed.length}.` }
  }

  const { data: existing } = await supabase
    .from('quick_replies')
    .select('id')
    .eq('client_id', clientId)
    .eq('created_by', userId)
    .eq('script_id', scriptId)
    .eq('lang', lang)
    .eq('scope', 'personal')
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('quick_replies')
      .update({ title, body: trimmed, active: true })
      .eq('client_id', clientId)
      .eq('id', (existing as { id: string }).id)
    if (error) return { ok: false, message: messageFor(error) }
    return { ok: true }
  }

  const { error } = await supabase.from('quick_replies').insert({
    client_id: clientId,
    created_by: userId,
    script_id: scriptId,
    lang,
    scope: 'personal',
    title,
    body: trimmed,
  })
  if (error) {
    // Lost the race against another tab — the row exists now, so update it.
    if (error.code === '23505') {
      const { error: retryError } = await supabase
        .from('quick_replies')
        .update({ title, body: trimmed, active: true })
        .eq('client_id', clientId)
        .eq('created_by', userId)
        .eq('script_id', scriptId)
        .eq('lang', lang)
      if (retryError) return { ok: false, message: messageFor(retryError) }
      return { ok: true }
    }
    return { ok: false, message: messageFor(error) }
  }
  return { ok: true }
}

export async function deleteSpin(clientId: string, id: string): Promise<WriteResult> {
  const { error } = await supabase.from('quick_replies').delete().eq('client_id', clientId).eq('id', id)
  if (error) return { ok: false, message: messageFor(error) }
  return { ok: true }
}

// ------------------------------------------------------------------- teardown

export type TeardownObjection = { taxonomyId: string; label: string; count: number }
export type TeardownGap = {
  id: string
  taxonomyId: string
  label: string
  words: string | null
  authorName: string | null
  createdAt: string
}
export type TeardownData = {
  objections: TeardownObjection[]
  gaps: TeardownGap[]
}

/** Monday 00:00 local for the week containing `date`. The teardown is a weekly
 *  ritual, so the boundary has to be stable across the meeting itself. */
export function weekStart(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  // getDay(): 0=Sunday. Sunday belongs to the week that started six days ago.
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d
}

export function weekEnd(start: Date): Date {
  const d = new Date(start)
  d.setDate(d.getDate() + 7)
  return d
}

/** The week's objection volume by taxonomy, plus the still-open gaps. Win rates
 *  come from useWinRates (scripts-data) and the scripts themselves from
 *  useScriptLibrary — this hook deliberately does NOT re-read either. */
export function useTeardown(clientId: string | null, start: Date) {
  const [data, setData] = useState<TeardownData>({ objections: [], gaps: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const startIso = start.toISOString()
  const endIso = weekEnd(start).toISOString()

  const load = useCallback(async () => {
    if (!clientId) {
      setData({ objections: [], gaps: [] })
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const [logsRes, gapsRes, taxRes, profilesRes] = await Promise.all([
      supabase
        .from('objection_logs')
        .select('taxonomy_id')
        .eq('client_id', clientId)
        // An undone log is a correction, not a signal — it must not shape the
        // week's ranking.
        .is('undone_at', null)
        .gte('occurred_at', startIso)
        .lt('occurred_at', endIso)
        .limit(TEARDOWN_LIMIT),
      supabase
        .from('playbook_gaps')
        .select('id, taxonomy_id, exact_customer_words, created_by, created_at')
        .eq('client_id', clientId)
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(TEARDOWN_LIMIT),
      supabase.from('objection_taxonomy').select('id, label').eq('client_id', clientId).limit(TEARDOWN_LIMIT),
      supabase.from('profiles').select('user_id, display_name').eq('client_id', clientId).limit(TEARDOWN_LIMIT),
    ])

    const firstError = logsRes.error ?? gapsRes.error ?? taxRes.error
    if (firstError) {
      setError(firstError.message)
      setLoading(false)
      return
    }
    setError(null)

    const labelById = new Map(
      ((taxRes.data ?? []) as { id: string; label: string }[]).map((t) => [t.id, t.label]),
    )
    const nameByUser = new Map(
      ((profilesRes.data ?? []) as { user_id: string; display_name: string }[]).map((p) => [p.user_id, p.display_name]),
    )

    const counts = new Map<string, number>()
    for (const row of (logsRes.data ?? []) as { taxonomy_id: string }[]) {
      counts.set(row.taxonomy_id, (counts.get(row.taxonomy_id) ?? 0) + 1)
    }

    setData({
      objections: [...counts.entries()]
        .map(([taxonomyId, count]) => ({ taxonomyId, label: labelById.get(taxonomyId) ?? 'Unknown', count }))
        .sort((a, b) => b.count - a.count),
      gaps: (
        (gapsRes.data ?? []) as {
          id: string
          taxonomy_id: string
          exact_customer_words: string | null
          created_by: string | null
          created_at: string
        }[]
      ).map((g) => ({
        id: g.id,
        taxonomyId: g.taxonomy_id,
        label: labelById.get(g.taxonomy_id) ?? 'Unknown',
        words: g.exact_customer_words,
        authorName: g.created_by ? (nameByUser.get(g.created_by) ?? null) : null,
        createdAt: g.created_at,
      })),
    })
    setLoading(false)
  }, [clientId, startIso, endIso])

  useEffect(() => {
    void load()
  }, [load])

  return { ...data, loading, error, reload: load }
}

/** Close a gap once its rebuttal is live. No RPC exists for this and none is
 *  needed: playbook_gaps is manager-updatable by RLS (048). */
export async function closeGap(clientId: string, id: string): Promise<WriteResult> {
  const { data, error } = await supabase
    .from('playbook_gaps')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('client_id', clientId)
    .eq('id', id)
    .select('id')
  if (error) return { ok: false, message: messageFor(error) }
  if (!data || data.length === 0) return { ok: false, message: DENIED }
  return { ok: true }
}

/** True when the company standard was rewritten after the rep saved their spin,
 *  which is the one thing a rep must be told before they keep using their own
 *  wording on a call. */
export function spinIsStale(standardCreatedAt: string | null | undefined, spinUpdatedAt: string): boolean {
  if (!standardCreatedAt) return false
  return new Date(standardCreatedAt).getTime() > new Date(spinUpdatedAt).getTime()
}

/** The plain text a spin starts from: the standard's own words in that dialect,
 *  merge tokens left intact so the rep keeps them. */
export function spinSeedText(body: ScriptBody | null | undefined, lang: string): string {
  const variant = body?.variants?.[lang]
  const paragraphs = variant?.paragraphs?.length ? variant.paragraphs : (body?.paragraphs ?? [])
  return paragraphs.map((p) => `${p.before}${p.highlight ?? ''}${p.after ?? ''}`).join('\n\n')
}
