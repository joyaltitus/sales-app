import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { hubFetch } from './api'

// Manage-view data layer (AT-29) — the client_admin's configuration surface.
//
// The dividing line this module encodes, stated once in ONBOARDING-SYSTEM §G.1:
// content that changes WHAT is said is client-safe with lint; content that
// changes WHEN or WHETHER something fires is the operator's. That is why some
// writes below are ordinary PostgREST updates and others are RPCs — the split is
// not stylistic, it mirrors migration 069's column locks:
//
//   items.slug            — tg_items_lock_slug rejects a browser change
//   campaigns.trigger     — tg_campaigns_lock_cols; door is pm_set_campaign_trigger
//   campaigns.spend_minor — same trigger; door is pm_set_campaign_spend
//   campaigns.created_by  — FORCED to auth.uid() on insert, never sent from here
//   playbook_rules.*      — super_admin-write; the two-column door is
//                           pm_edit_rule_response (response_text + bundle only)
//
// Sending a locked column would not be "denied politely": the trigger raises and
// the whole statement fails. So this module never sends one, and the tabs render
// them read-only rather than disabled-but-present.
//
// Every read is tenant-scoped and bounded (house rule; AdminShell.wall.test
// asserts the shape empirically on the landing route).
const LIMIT = 200
const REVISION_LIMIT = 20

/** One bounded, tenant-scoped list read. Every manage tab goes through this, so
 *  `.eq('client_id')` and `.limit()` are structural rather than remembered. */
function useList<T>(
  clientId: string | null,
  table: string,
  columns: string,
  order: { column: string; ascending: boolean },
) {
  const [items, setItems] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!clientId) {
      setItems([])
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error: err } = await supabase
      .from(table)
      .select(columns)
      .eq('client_id', clientId)
      .order(order.column, { ascending: order.ascending })
      .limit(LIMIT)
    if (err) {
      setItems([])
      setError(err.message)
      setLoading(false)
      return
    }
    setError(null)
    setItems((data ?? []) as T[])
    setLoading(false)
    // `order` is a fresh object each render; its two fields are the real deps.
  }, [clientId, table, columns, order.column, order.ascending])

  useEffect(() => {
    void load()
  }, [load])

  return { items, loading, error, reload: load }
}

export type WriteResult = { ok: true } | { ok: false; code: string; detail?: string }

function failed(message: string, code?: string): WriteResult {
  return { ok: false, code: code ?? 'write_failed', detail: message }
}

/** A refusal from a pm_* RPC. They answer `{ok:false, reason:...}` in the BODY
 *  rather than raising, so a 200 with ok:false is still a refusal. */
function fromRpc(data: unknown, error: { message: string } | null): WriteResult {
  if (error) return failed(error.message)
  const body = (data ?? {}) as { ok?: boolean; reason?: string }
  if (body.ok) return { ok: true }
  return { ok: false, code: body.reason ?? 'refused' }
}

// ---------------------------------------------------------------------------
// Honesty lint — client-side, advisory, NEVER a wall.
// ---------------------------------------------------------------------------
// The guardrail on the send path is the real authority on what may reach a
// customer. This is authoring lint: it warns the person typing, before the row
// exists, that the sentence they wrote is the kind the guardrail strips. It
// deliberately does not block a save — a false positive that cannot be
// overridden would make the surface unusable, and the guardrail still holds.
export type HonestyWarning = { key: string; why: string }

const HONESTY_FAMILIES: { key: string; re: RegExp; why: string }[] = [
  {
    key: 'guarantee',
    re: /\b(guarantee\w*|assured|100\s*%|risk[-\s]?free|definitely will)\b/i,
    why: 'Reads as a promise of outcome. The send-path guardrail strips promises it cannot verify.',
  },
  {
    key: 'discount',
    re: /\b(discount\w*|cashback|waive\w*|free of cost|special price|lowest price)\b/i,
    why: 'States a price concession. Only prices that exist on a product survive the guardrail.',
  },
  {
    key: 'confirmation',
    re: /\b(confirmed|your (seat|slot|room|booking) is (held|reserved|blocked)|reserved for you)\b/i,
    why: 'Claims a booking exists. Only pm_create_booking can confirm one, so this can be false when sent.',
  },
]

/** Advisory only — the caller shows these and still allows the save. */
export function honestyLint(text: string | null | undefined): HonestyWarning[] {
  if (!text) return []
  return HONESTY_FAMILIES.filter((f) => f.re.test(text)).map((f) => ({ key: f.key, why: f.why }))
}

// ---------------------------------------------------------------------------
// Keyword collision lint (pm_lint_keywords) — this one IS a wall for FAQs.
// ---------------------------------------------------------------------------
export type Collision = {
  keyword: string
  kind: 'rule' | 'knowledge' | 'escalation' | 'optout' | 'campaign'
  ref: string | null
  severity: 'warn' | 'block'
}

export type LintResult = { ok: boolean; collisions: Collision[]; has_block: boolean }

export const EMPTY_LINT: LintResult = { ok: true, collisions: [], has_block: false }

/** A `block` collision means the keyword overlaps the escalation or opt-out
 *  lexicon — the two lexicons that decide whether a customer reaches a human or
 *  stops hearing from us at all. Those are never client-overridable, so the
 *  caller must refuse the save rather than warn about it. */
export async function lintKeywords(
  clientId: string,
  keywords: string[],
  context: 'rule' | 'knowledge' | 'campaign',
): Promise<LintResult> {
  if (keywords.length === 0) return EMPTY_LINT
  const { data, error } = await supabase.rpc('pm_lint_keywords', {
    p_client_id: clientId,
    p_keywords: keywords,
    p_context: context,
  })
  if (error) return EMPTY_LINT
  const body = (data ?? {}) as Partial<LintResult>
  return {
    ok: body.ok ?? true,
    collisions: body.collisions ?? [],
    has_block: body.has_block ?? false,
  }
}

// ---------------------------------------------------------------------------
// Products (items)
// ---------------------------------------------------------------------------
export type Product = {
  id: string
  slug: string
  name: string
  category: string | null
  description: string | null
  price: number
  ai_instruction: string | null
  active: boolean
}

const PRODUCT_COLUMNS = 'id, slug, name, category, description, price, ai_instruction, active'
const PRODUCT_ORDER = { column: 'name', ascending: true }

export function useProducts(clientId: string | null) {
  return useList<Product>(clientId, 'items', PRODUCT_COLUMNS, PRODUCT_ORDER)
}

/** `slug` is absent from the patch on purpose — 069's tg_items_lock_slug raises
 *  on a browser change, so including it (even unchanged) is a statement waiting
 *  to fail. The tab renders it read-only for the same reason. */
export async function saveProduct(
  clientId: string,
  id: string,
  patch: Pick<Product, 'name' | 'category' | 'description' | 'price' | 'ai_instruction'>,
): Promise<WriteResult> {
  const { data, error } = await supabase
    .from('items')
    .update(patch)
    .eq('client_id', clientId)
    .eq('id', id)
    .select('id')
  if (error) return failed(error.message)
  if (!data || data.length === 0) return { ok: false, code: 'denied' }
  return { ok: true }
}

// ---------------------------------------------------------------------------
// FAQs (knowledge_entries)
// ---------------------------------------------------------------------------
export type Faq = {
  id: string
  category: string | null
  question: string | null
  keywords: string[]
  answer: string
  follow_up: string | null
  active: boolean
}

const FAQ_COLUMNS = 'id, category, question, keywords, answer, follow_up, active'
const FAQ_ORDER = { column: 'created_at', ascending: false }

export function useFaqs(clientId: string | null) {
  return useList<Faq>(clientId, 'knowledge_entries', FAQ_COLUMNS, FAQ_ORDER)
}

export async function saveFaq(
  clientId: string,
  id: string,
  patch: Pick<Faq, 'question' | 'answer' | 'follow_up' | 'keywords'>,
): Promise<WriteResult> {
  const { data, error } = await supabase
    .from('knowledge_entries')
    .update(patch)
    .eq('client_id', clientId)
    .eq('id', id)
    .select('id')
  if (error) return failed(error.message)
  if (!data || data.length === 0) return { ok: false, code: 'denied' }
  return { ok: true }
}

export async function createFaq(
  clientId: string,
  row: Pick<Faq, 'question' | 'answer' | 'follow_up' | 'keywords'>,
): Promise<WriteResult> {
  const { error } = await supabase
    .from('knowledge_entries')
    .insert({ client_id: clientId, ...row })
    .select('id')
  if (error) return failed(error.message)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Deactivate — pm_manage_record, which runs the reference lint first.
// ---------------------------------------------------------------------------
export type ManageKind = 'item' | 'knowledge' | 'rule' | 'campaign'

export type DeactivateResult =
  | { ok: true; refs: { kind: string; ref: string }[] }
  | { ok: false; code: string }

/** `refs` is the blast radius, not an error: the row IS deactivated and these
 *  are the things that still point at it. Showing them loudly is the whole
 *  point — a deactivated bundle or stage target breaks routing silently.
 *  The record is addressed by its NATURAL key (slug / question / rule_key /
 *  campaign_key), which is what pm_manage_record maps per kind. */
export async function deactivateRecord(
  clientId: string,
  kind: ManageKind,
  recordKey: string,
  userId: string,
): Promise<DeactivateResult> {
  const { data, error } = await supabase.rpc('pm_manage_record', {
    p_client_id: clientId,
    p_kind: kind,
    p_record_key: recordKey,
    p_action: 'deactivate',
    p_auth_user_id: userId,
  })
  if (error) return { ok: false, code: 'write_failed' }
  const body = (data ?? {}) as { ok?: boolean; reason?: string; refs?: { kind: string; ref: string }[] }
  if (!body.ok) return { ok: false, code: body.reason ?? 'refused' }
  return { ok: true, refs: body.refs ?? [] }
}

// ---------------------------------------------------------------------------
// Business profile — the singleton, draft → apply
// ---------------------------------------------------------------------------
export type ProfileDraft = {
  greeting_message: string | null
  fallback_message: string | null
  escalation_contact: string | null
  location_text: string | null
  payment_text: string | null
}

export type Profile = ProfileDraft & {
  id: string
  /** Routing lexicon — operator-owned, rendered read-only. */
  escalation_keywords: string[]
  draft: ProfileDraft | null
  draft_updated_at: string | null
}

export const PROFILE_FIELDS: (keyof ProfileDraft)[] = [
  'greeting_message',
  'fallback_message',
  'escalation_contact',
  'location_text',
  'payment_text',
]

/** The singleton read. One row per tenant, so `.limit(1)` is the bound and
 *  `maybeSingle()` is deliberately avoided — a tenant provisioned without a
 *  profile row is a real state, not an error. */
export function useProfile(clientId: string | null) {
  const [item, setItem] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!clientId) {
      setItem(null)
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error: err } = await supabase
      .from('business_profile')
      .select(
        'id, greeting_message, fallback_message, escalation_contact, location_text, payment_text, escalation_keywords, draft, draft_updated_at',
      )
      .eq('client_id', clientId)
      .limit(1)
    if (err) {
      setItem(null)
      setError(err.message)
      setLoading(false)
      return
    }
    setError(null)
    setItem(((data ?? [])[0] as Profile | undefined) ?? null)
    setLoading(false)
  }, [clientId])

  useEffect(() => {
    void load()
  }, [load])

  return { item, loading, error, reload: load }
}

/** Stage an edit without changing what the bot says. §G.2 rule 6: singletons
 *  are draft → apply (a greeting is guest-facing and there is exactly one), row
 *  tables are live-with-history. */
export async function saveProfileDraft(
  clientId: string,
  id: string,
  draft: ProfileDraft,
): Promise<WriteResult> {
  const { data, error } = await supabase
    .from('business_profile')
    .update({ draft, draft_updated_at: new Date().toISOString() })
    .eq('client_id', clientId)
    .eq('id', id)
    .select('id')
  if (error) return failed(error.message)
  if (!data || data.length === 0) return { ok: false, code: 'denied' }
  return { ok: true }
}

/** Promote the draft to live and clear it. escalation_keywords is NOT in the
 *  patch: it is the routing lexicon, operator-owned, and a draft never carries
 *  it. */
export async function applyProfileDraft(
  clientId: string,
  id: string,
  draft: ProfileDraft,
): Promise<WriteResult> {
  const { data, error } = await supabase
    .from('business_profile')
    .update({ ...draft, draft: null, draft_updated_at: null })
    .eq('client_id', clientId)
    .eq('id', id)
    .select('id')
  if (error) return failed(error.message)
  if (!data || data.length === 0) return { ok: false, code: 'denied' }
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Objection replies (playbook_rules, 400-band + TELL)
// ---------------------------------------------------------------------------
export type Rule = {
  id: string
  rule_key: string
  priority: number
  trigger_keywords: string[]
  match_mode: string
  response_text: string
  media_bundle_key: string | null
  active: boolean
}

const RULE_COLUMNS =
  'id, rule_key, priority, trigger_keywords, match_mode, response_text, media_bundle_key, active'

/** The client-editable slice of an operator-owned table: the 400 objection band
 *  plus any TELL rule (ONBOARDING-SYSTEM §G.1). Everything else on a rule —
 *  keywords, priority, chains, stage gates — stays the operator's, and the RPC
 *  behind `editRuleResponse` can only reach two columns regardless. */
export function useObjectionRules(clientId: string | null) {
  const [items, setItems] = useState<Rule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!clientId) {
      setItems([])
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error: err } = await supabase
      .from('playbook_rules')
      .select(RULE_COLUMNS)
      .eq('client_id', clientId)
      .or('and(priority.gte.400,priority.lt.500),rule_key.ilike.tell*')
      .order('priority', { ascending: true })
      .limit(LIMIT)
    if (err) {
      setItems([])
      setError(err.message)
      setLoading(false)
      return
    }
    setError(null)
    setItems((data ?? []) as Rule[])
    setLoading(false)
  }, [clientId])

  useEffect(() => {
    void load()
  }, [load])

  return { items, loading, error, reload: load }
}

/** Read-only, plain-language rendering of a rule's trigger. The client may not
 *  edit these words — a keyword change silently re-routes conversations — so
 *  they are stated as a sentence rather than shown as an editable field. */
export function triggerSentence(rule: Pick<Rule, 'trigger_keywords' | 'match_mode'>): string {
  const words = rule.trigger_keywords.filter(Boolean)
  if (words.length === 0) return 'This reply is chosen by the assistant, not by a trigger word.'
  const quoted = words.map((w) => `“${w}”`)
  if (words.length === 1) return `This reply fires when someone says ${quoted[0]}.`
  const joiner = rule.match_mode === 'all' ? ' and ' : ' or '
  const last = quoted[quoted.length - 1]
  return `This reply fires when someone says ${quoted.slice(0, -1).join(', ')}${joiner}${last}.`
}

/** The two-column door. `p_auth_user_id` is a revision LABEL, not authority —
 *  069 walls on has_role()/auth.uid() and ignores this argument for access. */
export async function editRuleResponse(
  clientId: string,
  ruleKey: string,
  responseText: string,
  bundleKey: string | null,
  userId: string,
): Promise<WriteResult> {
  const { data, error } = await supabase.rpc('pm_edit_rule_response', {
    p_client_id: clientId,
    p_rule_key: ruleKey,
    p_response_text: responseText,
    p_media_bundle_key: bundleKey,
    p_auth_user_id: userId,
  })
  return fromRpc(data, error)
}

export type Bundle = { id: string; bundle_key: string }

/** Existing bundles only — creating one is a media-flow action, not a manage
 *  edit, and pm_edit_rule_response refuses a key the tenant does not have. */
export function useBundles(clientId: string | null) {
  return useList<Bundle>(clientId, 'media_bundles', 'id, bundle_key', {
    column: 'bundle_key',
    ascending: true,
  })
}

// ---------------------------------------------------------------------------
// Campaigns
// ---------------------------------------------------------------------------
export type CampaignTrigger = { code_keywords: string[]; ctwa_source_ids: string[] }

export type Campaign = {
  id: string
  campaign_key: string
  name: string
  channel: string
  context_text: string | null
  trigger: CampaignTrigger
  spend_minor: number
  active: boolean
  starts_at: string | null
  ends_at: string | null
}

const CAMPAIGN_COLUMNS =
  'id, campaign_key, name, channel, context_text, trigger, spend_minor, active, starts_at, ends_at'
const CAMPAIGN_ORDER = { column: 'created_at', ascending: false }

/** 070 widened the channel CHECK for Google; this list mirrors it. A value not
 *  in the constraint fails the insert outright, so the picker is the contract. */
export const CAMPAIGN_CHANNELS = [
  'whatsapp',
  'instagram',
  'meta_ads',
  'google_ads',
  'referral',
  'other',
] as const

export function useCampaigns(clientId: string | null) {
  return useList<Campaign>(clientId, 'campaigns', CAMPAIGN_COLUMNS, CAMPAIGN_ORDER)
}

/** Create sends NEITHER `trigger`, `spend_minor` nor `created_by`: 069's
 *  tg_campaigns_lock_cols overwrites all three on a browser insert (empty
 *  trigger, zero spend, created_by = auth.uid()). Code words and spend arrive
 *  afterwards through their own RPCs, which is where the collision gate lives. */
export async function createCampaign(
  clientId: string,
  row: {
    campaign_key: string
    name: string
    channel: string
    context_text: string | null
    starts_at: string | null
    ends_at: string | null
    active: boolean
  },
): Promise<WriteResult> {
  const { error } = await supabase
    .from('campaigns')
    .insert({ client_id: clientId, ...row })
    .select('id')
  if (error) return failed(error.message)
  return { ok: true }
}

export async function saveCampaign(
  clientId: string,
  id: string,
  patch: Pick<Campaign, 'name' | 'context_text' | 'starts_at' | 'ends_at' | 'active'>,
): Promise<WriteResult> {
  const { data, error } = await supabase
    .from('campaigns')
    .update(patch)
    .eq('client_id', clientId)
    .eq('id', id)
    .select('id')
  if (error) return failed(error.message)
  if (!data || data.length === 0) return { ok: false, code: 'denied' }
  return { ok: true }
}

export type TriggerResult =
  | { ok: true; warnings: Collision[] }
  | { ok: false; code: string; collisions: Collision[] }

/** The routing lexicon. This RPC refuses the WHOLE write on a hard collision —
 *  the two lexicons, a live rule's keyword, or another live campaign's code
 *  word — and returns the offending list. A code word that collides with the
 *  opt-out lexicon would make the campaign eat every customer's "STOP", which
 *  is why it is a refusal and not a warning. */
export async function setCampaignTrigger(
  clientId: string,
  campaignKey: string,
  codeKeywords: string[],
  ctwaSourceIds: string[],
  userId: string,
): Promise<TriggerResult> {
  const { data, error } = await supabase.rpc('pm_set_campaign_trigger', {
    p_client_id: clientId,
    p_campaign_key: campaignKey,
    p_code_keywords: codeKeywords,
    p_ctwa_source_ids: ctwaSourceIds,
    p_auth_user_id: userId,
  })
  if (error) return { ok: false, code: 'write_failed', collisions: [] }
  const body = (data ?? {}) as {
    ok?: boolean
    reason?: string
    collisions?: Collision[]
    warnings?: Collision[]
  }
  if (!body.ok) {
    return {
      ok: false,
      code: body.reason ?? (body.collisions?.length ? 'collision' : 'refused'),
      collisions: body.collisions ?? [],
    }
  }
  return { ok: true, warnings: body.warnings ?? [] }
}

export async function setCampaignSpend(
  clientId: string,
  campaignKey: string,
  spendMinor: number,
  userId: string,
): Promise<WriteResult> {
  const { data, error } = await supabase.rpc('pm_set_campaign_spend', {
    p_client_id: clientId,
    p_campaign_key: campaignKey,
    p_spend_minor: spendMinor,
    p_auth_user_id: userId,
  })
  return fromRpc(data, error)
}

// ---------------------------------------------------------------------------
// History (record_revisions) + revert
// ---------------------------------------------------------------------------
export type Revision = {
  id: string
  table_name: string
  record_pk: string
  record_key: string | null
  op: 'insert' | 'update' | 'delete'
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  actor: string | null
  source: string
  created_at: string
}

/** History for ONE row. `record_pk` is the addressing key (037 indexes exactly
 *  this), so a row keeps its history across a natural-key rename. */
export function useRevisions(clientId: string | null, tableName: string, recordPk: string | null) {
  const [items, setItems] = useState<Revision[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!clientId || !recordPk) {
      setItems([])
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error: err } = await supabase
      .from('record_revisions')
      .select('id, table_name, record_pk, record_key, op, before, after, actor, source, created_at')
      .eq('client_id', clientId)
      .eq('table_name', tableName)
      .eq('record_pk', recordPk)
      .order('created_at', { ascending: false })
      .limit(REVISION_LIMIT)
    if (err) {
      setItems([])
      setError(err.message)
      setLoading(false)
      return
    }
    setError(null)
    setItems((data ?? []) as Revision[])
    setLoading(false)
  }, [clientId, tableName, recordPk])

  useEffect(() => {
    void load()
  }, [load])

  return { items, loading, error, reload: load }
}

/** The columns a revert may restore, per table — deliberately the SAME set each
 *  tab can edit. A revision's `before` is a whole-row snapshot and contains
 *  locked columns (items.slug, campaigns.created_by) that a browser write
 *  cannot set; replaying it verbatim would fail the statement, not the field. */
const REVERTABLE: Record<string, string[]> = {
  items: ['name', 'category', 'description', 'price', 'ai_instruction', 'active'],
  knowledge_entries: ['question', 'answer', 'follow_up', 'keywords', 'active'],
  business_profile: PROFILE_FIELDS,
  campaigns: ['name', 'context_text', 'starts_at', 'ends_at', 'active'],
  playbook_rules: ['response_text', 'media_bundle_key'],
}

function pick(row: Record<string, unknown>, columns: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const c of columns) if (c in row) out[c] = row[c]
  return out
}

/**
 * Revert = write `before` FORWARD as a new edit, through the same door the tab
 * uses. Never a raw rewind.
 *
 * This is the difference between an audit trail and a time machine. A rewind
 * would have to bypass the write path — which means bypassing the collision
 * gate, the column locks and the honesty rails that made the original edit
 * legal. It would also have to erase or rewrite the revision rows, and 037
 * gives the browser no INSERT/UPDATE/DELETE on record_revisions precisely so
 * that history can be neither forged nor erased. So a revert leaves a NEW
 * revision behind, exactly like any other edit, and the row's history reads as
 * what actually happened rather than as what someone wishes had happened.
 *
 * Campaign code words and spend go back through their RPCs for the same reason:
 * restoring an old code word must re-run the collision gate, because the
 * lexicon it collides with may have changed since.
 */
export async function revertTo(
  clientId: string,
  revision: Revision,
  userId: string,
): Promise<WriteResult> {
  const before = revision.before
  if (!before) return { ok: false, code: 'nothing_to_restore' }
  const columns = REVERTABLE[revision.table_name]
  if (!columns) return { ok: false, code: 'not_revertable' }

  if (revision.table_name === 'playbook_rules') {
    const key = (before.rule_key as string) ?? revision.record_key
    if (!key) return { ok: false, code: 'no_rule_key' }
    return editRuleResponse(
      clientId,
      key,
      (before.response_text as string) ?? '',
      (before.media_bundle_key as string | null) ?? null,
      userId,
    )
  }

  const patch = pick(before, columns)
  const { data, error } = await supabase
    .from(revision.table_name)
    .update(patch)
    .eq('client_id', clientId)
    .eq('id', revision.record_pk)
    .select('id')
  if (error) return failed(error.message)
  if (!data || data.length === 0) return { ok: false, code: 'denied' }

  if (revision.table_name === 'campaigns') {
    const key = (before.campaign_key as string) ?? revision.record_key
    if (!key) return { ok: true }
    const trigger = (before.trigger ?? {}) as Partial<CampaignTrigger>
    const triggerRes = await setCampaignTrigger(
      clientId,
      key,
      trigger.code_keywords ?? [],
      trigger.ctwa_source_ids ?? [],
      userId,
    )
    // The table update above has ALREADY COMMITTED by the time we get here, and
    // pm_set_campaign_trigger commits too, so there is no ordering of these
    // three legs that removes the partial window — only a pm_revert_campaign
    // RPC could, and that SQL is not in this repo (Phase 3). Do not reorder
    // them; report the partial state instead of claiming nothing changed.
    //
    // This matters more than it looks: `active` is in REVERTABLE.campaigns, so
    // a refused trigger leg can leave a campaign switched back ON while still
    // carrying today's code words.
    if (!triggerRes.ok) return { ok: false, code: `partial:${triggerRes.code}`, detail: 'code words' }
    if (typeof before.spend_minor === 'number') {
      const spendRes = await setCampaignSpend(clientId, key, before.spend_minor, userId)
      if (!spendRes.ok) return { ok: false, code: `partial:${spendRes.code}`, detail: 'spend' }
    }
  }
  return { ok: true }
}


// ---------------------------------------------------------------------------
// Staleness badge — is the last scored config still the config we are running?
// ---------------------------------------------------------------------------
export const ONBOARDING_STATUS_PATH = '/api/onboarding/status'

export type Staleness =
  /** No scorecard exists, or the hash could not be read. Say nothing rather
   *  than imply a verdict — an unknown badge is worse than no badge. */
  | { kind: 'unknown' }
  | { kind: 'fresh'; hash: string }
  | { kind: 'stale'; scoredHash: string; currentHash: string; scoredAt: string | null }

/** The scorecard's hash comes from `test_runs`, the live one from session E's
 *  `GET /api/onboarding/status/:clientId`. A mismatch means the configuration
 *  has changed since it was last verified, so any "verified" claim on this
 *  tenant is out of date — which is the entire content of the badge. */
export function useConfigStaleness(clientId: string | null) {
  const [state, setState] = useState<Staleness>({ kind: 'unknown' })

  const load = useCallback(async () => {
    if (!clientId) {
      setState({ kind: 'unknown' })
      return
    }
    const [runRes, status] = await Promise.all([
      supabase
        .from('test_runs')
        .select('config_hash, created_at')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(1),
      hubFetch<{ config_hash?: string }>(`${ONBOARDING_STATUS_PATH}/${clientId}`),
    ])
    const run = ((runRes.data ?? [])[0] ?? null) as { config_hash: string; created_at: string } | null
    const currentHash = status.kind === 'ok' ? status.data?.config_hash : undefined
    if (!run || !currentHash) {
      setState({ kind: 'unknown' })
      return
    }
    setState(
      run.config_hash === currentHash
        ? { kind: 'fresh', hash: currentHash }
        : {
            kind: 'stale',
            scoredHash: run.config_hash,
            currentHash,
            scoredAt: run.created_at,
          },
    )
  }, [clientId])

  useEffect(() => {
    void load()
  }, [load])

  return { state, reload: load }
}
