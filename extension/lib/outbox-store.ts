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
import type { CallOutcome, OutboxEntry } from './contracts'
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
    const result = await createLead(text(args, 'client_id'), {
      profileName: text(args, 'profile_name'),
      phone: text(args, 'phone'),
      channel: optionalText(args, 'channel') ?? 'whatsapp',
      stageId: text(args, 'stage_id'),
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
}

export async function readOutbox(): Promise<OutboxEntry[]> {
  const stored = await chrome.storage.local.get(OUTBOX_KEY)
  return Array.isArray(stored[OUTBOX_KEY]) ? stored[OUTBOX_KEY] as OutboxEntry[] : []
}

export async function queueWrite(
  kind: OutboxEntry['kind'],
  args: Args,
  now = new Date(),
): Promise<{ ok: true; entry: OutboxEntry } | { ok: false; error: 'OUTBOX_FULL' }> {
  const entry: OutboxEntry = {
    id: crypto.randomUUID(),
    kind,
    args: kind === 'save_lead'
      ? { ...args, saved_offline_at: now.toISOString(), offline_label: `saved offline at ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` }
      : args,
    created_at: now.toISOString(),
    attempts: 0,
    last_error: null,
  }
  const result = enqueue(await readOutbox(), entry)
  if (!result.ok) return { ok: false, error: result.error }
  await chrome.storage.local.set({ [OUTBOX_KEY]: result.list })
  return { ok: true, entry }
}

export async function drainOutbox(): Promise<ReturnType<typeof drain> extends Promise<infer T> ? T : never> {
  const result = await drain(await readOutbox(), (entry) => WRITE_REGISTRY[entry.kind](entry))
  await chrome.storage.local.set({ [OUTBOX_KEY]: result.remaining })
  return result
}
