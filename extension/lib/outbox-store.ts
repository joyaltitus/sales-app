import { completeCall } from '@app/lib/calls-data'
import {
  addFollowUp,
  addNote,
  createLead,
  saveLeadLastWriteWins,
  updateFollowUp,
  type LeadPatch,
} from '@app/lib/crm-actions'
import { logObjection, type ObjectionSource } from '@app/lib/objections-data'
import { updateScriptUsageFeedback } from '@app/lib/scripts-data'
import type { CallOutcome, OutboxEntry } from './contracts'
import { panelSupabase } from './panel-client'
import { drain, enqueue } from './outbox'

export const OUTBOX_KEY = 'rep.outbox'

type Args = Record<string, unknown>

function text(args: Args, key: string): string {
  const value = args[key]
  if (typeof value !== 'string' || !value) throw new Error(`Invalid outbox argument: ${key}`)
  return value
}

function optionalText(args: Args, key: string): string | null {
  const value = args[key]
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') throw new Error(`Invalid outbox argument: ${key}`)
  return value
}

function assertOk(
  result: { ok: boolean; message?: string; reason?: string; code?: string },
  duplicateIsDone = false,
): void {
  if (!result.ok && duplicateIsDone && result.code === '23505') return
  if (!result.ok) throw new Error(result.message ?? result.reason ?? 'Write was denied')
}

/** Closed write registry. It deliberately contains no send or billing operation. */
export const WRITE_REGISTRY: Record<OutboxEntry['kind'], (entry: OutboxEntry) => Promise<void>> = {
  async log_outcome(entry) {
    const args = entry.args
    const result = await completeCall(text(args, 'call_session_id'), text(args, 'outcome') as CallOutcome, {
      taxonomyKey: optionalText(args, 'taxonomy_key'),
      callbackAt: optionalText(args, 'callback_at'),
      note: optionalText(args, 'note'),
    })
    assertOk(result)
  },
  async save_lead(entry) {
    const args = entry.args
    const result = await saveLeadLastWriteWins(
      text(args, 'client_id'),
      text(args, 'lead_id'),
      (args.patch ?? {}) as LeadPatch,
    )
    assertOk(result)
  },
  async add_note(entry) {
    const args = entry.args
    const result = await addNote(text(args, 'client_id'), {
      id: entry.id,
      conversation_id: optionalText(args, 'conversation_id'),
      lead_id: optionalText(args, 'lead_id'),
      author: optionalText(args, 'author'),
      body: text(args, 'body'),
    })
    assertOk(result, true)
  },
  async add_follow_up(entry) {
    const args = entry.args
    const result = await addFollowUp(text(args, 'client_id'), {
      id: entry.id,
      contact_id: text(args, 'contact_id'),
      lead_id: optionalText(args, 'lead_id'),
      conversation_id: optionalText(args, 'conversation_id'),
      due_at: text(args, 'due_at'),
      note: text(args, 'note'),
      channel: text(args, 'channel'),
      created_by: optionalText(args, 'created_by'),
    })
    assertOk(result, true)
  },
  async update_follow_up(entry) {
    const args = entry.args
    const result = await updateFollowUp(
      text(args, 'client_id'),
      text(args, 'follow_up_id'),
      text(args, 'expected_status'),
      text(args, 'action') as 'done' | 'snooze1d' | 'snooze3d' | 'cancel',
    )
    // `expected_status` is frozen at enqueue, so once the row moves past it the
    // conditional `.eq('status', ...)` matches 0 rows and updateFollowUp reports
    // 'denied' on EVERY future replay. Throwing would stop `drain` at index 0 on
    // every reconnect, stranding every entry queued behind it, forever. For a
    // conditional status transition "no row matched" means someone already moved
    // it: done, not failed. (A true RLS denial is indistinguishable here and is
    // swallowed too — a lost status flip beats a permanently deadlocked queue.)
    if (!result.ok && result.reason === 'denied') return
    assertOk(result)
  },
  /**
   * Save-as-lead from the open chat. Safe to replay: create_manual_lead takes an
   * advisory lock on (client, channel, identity) and RETURNS the existing open
   * lead rather than making a second one, so a queued entry that already landed
   * before the panel went offline replays to the same lead id.
   */
  async create_lead(entry) {
    const args = entry.args
    const estValue = args.est_value
    const result = await createLead(text(args, 'client_id'), {
      profileName: text(args, 'profile_name'),
      phone: text(args, 'phone'),
      channel: optionalText(args, 'channel') ?? 'whatsapp',
      stageId: text(args, 'stage_id'),
      estValue: typeof estValue === 'number' ? estValue : null,
      nextAction: optionalText(args, 'next_action'),
      note: optionalText(args, 'note'),
    })
    assertOk(result)
  },
  async log_objection(entry) {
    const args = entry.args
    const result = await logObjection({
      id: entry.id,
      clientId: text(args, 'client_id'),
      contactId: text(args, 'contact_id'),
      conversationId: optionalText(args, 'conversation_id'),
      leadId: optionalText(args, 'lead_id'),
      taxonomyId: text(args, 'taxonomy_id'),
      source: text(args, 'source') as ObjectionSource,
      note: optionalText(args, 'note'),
      actorId: text(args, 'actor_id'),
    })
    assertOk(result, true)
  },

  // ── Playbook writes ────────────────────────────────────────────────────────
  //
  // insertScriptUsage/insertPlaybookGap in src/lib predate migration 068 and
  // take neither the client-minted id nor the new columns, so these go direct
  // under the same RLS the helpers rely on.
  // dedupe-after-PLAY-A: collapse into src/lib/scripts-data.ts once its
  // signatures carry id, call_session_id, lang, used_personal and
  // script_version_id.

  /** Insert-as-draft usage. The entry id IS the row id, so a double-tap that
   *  reuses the same handle collides on the primary key and 23505 means done. */
  async script_used(entry) {
    const args = entry.args
    const { error } = await panelSupabase.from('script_usage').insert({
      id: entry.id,
      client_id: text(args, 'client_id'),
      script_version_id: text(args, 'script_version_id'),
      actor_id: text(args, 'actor_id'),
      objection_log_id: optionalText(args, 'objection_log_id'),
      conversation_id: optionalText(args, 'conversation_id'),
      call_session_id: optionalText(args, 'call_session_id'),
      lang: optionalText(args, 'lang'),
      used_personal: args.used_personal === true,
      inserted_as_draft: true,
    })
    assertOk({ ok: !error, message: error?.message, code: error?.code }, true)
  },

  /** 👍/👎 — an UPDATE keyed by the usage id the panel minted at insert time. */
  async script_feedback(entry) {
    const result = await updateScriptUsageFeedback(
      text(entry.args, 'client_id'),
      text(entry.args, 'usage_id'),
      text(entry.args, 'feedback') as 'worked' | 'didnt_work',
    )
    assertOk(result)
  },

  /** "What did they say?" — the words the standard had no answer for. */
  async playbook_gap(entry) {
    const args = entry.args
    const { error } = await panelSupabase.from('playbook_gaps').insert({
      id: entry.id,
      client_id: text(args, 'client_id'),
      taxonomy_id: text(args, 'taxonomy_id'),
      script_version_id: optionalText(args, 'script_version_id'),
      objection_log_id: optionalText(args, 'objection_log_id'),
      exact_customer_words: optionalText(args, 'exact_customer_words'),
      created_by: text(args, 'created_by'),
    })
    // 23505 is uq_playbook_gaps_one_open: already flagged, not a failure.
    assertOk({ ok: !error, message: error?.message, code: error?.code }, true)
  },

  /** The rep's own wording, one row per (script, dialect) — upsert, not append. */
  async save_spin(entry) {
    const args = entry.args
    const { error } = await panelSupabase.from('quick_replies').upsert({
      client_id: text(args, 'client_id'),
      scope: 'personal',
      script_id: text(args, 'script_id'),
      lang: text(args, 'lang'),
      title: text(args, 'title'),
      body: text(args, 'body'),
      created_by: text(args, 'created_by'),
    }, { onConflict: 'client_id,created_by,script_id,lang' })
    assertOk({ ok: !error, message: error?.message, code: error?.code })
  },

  async delete_spin(entry) {
    const args = entry.args
    const { error } = await panelSupabase.from('quick_replies').delete()
      .eq('client_id', text(args, 'client_id'))
      .eq('created_by', text(args, 'created_by'))
      .eq('script_id', text(args, 'script_id'))
      .eq('lang', text(args, 'lang'))
      .eq('scope', 'personal')
    assertOk({ ok: !error, message: error?.message, code: error?.code })
  },

  /**
   * "Token received".
   *
   * lead_facts has no browser INSERT policy, so this tries the structured row
   * first and falls back to a note with a fixed prefix. Either way the money
   * shows up on the timeline — a rep who collected ₹5,000 and sees nothing is
   * a rep who stops trusting the button.
   */
  async token_received(entry) {
    const args = entry.args
    const clientId = text(args, 'client_id')
    const amount = typeof args.amount === 'number' ? args.amount : null
    const at = optionalText(args, 'at') ?? new Date().toISOString()
    const { error } = await panelSupabase.from('lead_facts').insert({
      id: entry.id,
      client_id: clientId,
      lead_id: text(args, 'lead_id'),
      kind: 'payment',
      fact_key: 'token_received',
      status: 'confirmed',
      value: { amount, at },
    })
    if (!error || error.code === '23505') return
    const note = await addNote(clientId, {
      id: entry.id,
      conversation_id: null,
      lead_id: text(args, 'lead_id'),
      author: optionalText(args, 'actor_id'),
      body: `TOKEN ₹${amount ?? '—'} received`,
    })
    assertOk(note, true)
  },
}

export async function readOutbox(): Promise<OutboxEntry[]> {
  const stored = await chrome.storage.local.get(OUTBOX_KEY)
  return Array.isArray(stored[OUTBOX_KEY]) ? stored[OUTBOX_KEY] as OutboxEntry[] : []
}

/**
 * Queue one write.
 *
 * `id` is the idempotency handle. Callers that can fire twice for the same real
 * action — the same script inserted twice into the same call — pass the SAME id
 * both times: the second enqueue is dropped here if it is still pending, and
 * collides on the primary key if it already drained. Either way, one row.
 */
export async function queueWrite(
  kind: OutboxEntry['kind'],
  args: Args,
  now = new Date(),
  id: string = crypto.randomUUID(),
): Promise<{ ok: true; entry: OutboxEntry } | { ok: false; error: 'OUTBOX_FULL' }> {
  const pending = await readOutbox()
  const already = pending.find((item) => item.id === id)
  if (already) return { ok: true, entry: already }
  const entry: OutboxEntry = {
    id,
    kind,
    args: kind === 'save_lead'
      ? { ...args, saved_offline_at: now.toISOString(), offline_label: `saved offline at ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` }
      : args,
    created_at: now.toISOString(),
    attempts: 0,
    last_error: null,
  }
  const result = enqueue(pending, entry)
  if (!result.ok) return { ok: false, error: result.error }
  await chrome.storage.local.set({ [OUTBOX_KEY]: result.list })
  return { ok: true, entry }
}

export async function drainOutbox(): Promise<ReturnType<typeof drain> extends Promise<infer T> ? T : never> {
  const result = await drain(await readOutbox(), (entry) => WRITE_REGISTRY[entry.kind](entry))
  await chrome.storage.local.set({ [OUTBOX_KEY]: result.remaining })
  return result
}
