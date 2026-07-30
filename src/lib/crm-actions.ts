import { supabase } from './supabase'

// SA-05 CRM/Inbox write layer — direct PostgREST writes under RLS, the same
// lane Workbench already uses browser-side (anon key + RLS; messages remain
// hub-service-only). EVERY write here follows leads-data's moveLeadStage
// contract: explicit client_id filter, `.select('id')` read-back, and a
// 0-row result means "RLS denied (or a concurrent edit)", not a bug — the
// caller reverts its optimistic paint and says so.
//
// ⚠ ROLE-WALL (§2): nothing here grants anything. Postgres decides on every
// statement; these helpers exist so every call site shares the denied-vs-error
// discrimination instead of re-inventing it.

export type WriteResult =
  | { ok: true }
  | { ok: false; reason: 'denied' | 'error'; message?: string }

function fromUpdate(data: unknown[] | null, error: { message: string } | null): WriteResult {
  if (error) return { ok: false, reason: 'error', message: error.message }
  if (!data || data.length === 0) return { ok: false, reason: 'denied' }
  return { ok: true }
}

/** Pause or resume the bot on one conversation. */
export async function setBotPaused(
  clientId: string,
  conversationId: string,
  paused: boolean,
): Promise<WriteResult> {
  // Column sets mirror Workbench Inbox.tsx exactly (pause marks the escalation
  // unresolved so "needs human" logic sees it; resume clears both).
  const patch: Record<string, unknown> = paused
    ? {
        bot_paused: true,
        pause_reason: 'manual',
        paused_at: new Date().toISOString(),
        escalation_resolved: false,
      }
    : { bot_paused: false, pause_reason: null, escalation_resolved: true }
  const { data, error } = await supabase
    .from('conversations')
    .update(patch)
    .eq('client_id', clientId)
    .eq('id', conversationId)
    .select('id')
  return fromUpdate(data, error)
}

/** Assign / unassign a conversation (Wave-1; RLS may deny for reps). */
export async function assignConversation(
  clientId: string,
  conversationId: string,
  userId: string | null,
): Promise<WriteResult> {
  const { data, error } = await supabase
    .from('conversations')
    .update({ assigned_to: userId })
    .eq('client_id', clientId)
    .eq('id', conversationId)
    .select('id')
  return fromUpdate(data, error)
}

export type LeadPatch = {
  stage_id?: string
  status?: string
  est_value?: number | null
  temperature_override?: string | null
  lost_reason?: string | null
  objection?: string | null
}

/** Save a lead from the drawer. Conditional on the stage the editor SAW
 *  (`expectedStageId`) so a concurrent stage move loses no data silently —
 *  the Workbench trick, kept. */
export async function saveLead(
  clientId: string,
  leadId: string,
  expectedStageId: string,
  patch: LeadPatch,
): Promise<WriteResult> {
  const { data, error } = await supabase
    .from('leads')
    .update(patch)
    .eq('client_id', clientId)
    .eq('id', leadId)
    .eq('stage_id', expectedStageId)
    .select('id')
  return fromUpdate(data, error)
}

export async function addFollowUp(
  clientId: string,
  row: {
    contact_id: string
    lead_id: string | null
    conversation_id: string | null
    due_at: string
    note: string
    channel: string
    created_by: string | null
  },
): Promise<WriteResult> {
  const { data, error } = await supabase
    .from('follow_ups')
    .insert({ client_id: clientId, status: 'pending', ...row })
    .select('id')
  return fromUpdate(data, error)
}

/** Complete / snooze / cancel a follow-up. Conditional on the status the row
 *  RENDERED (Workbench's guard) so two people acting at once can't double-
 *  complete; RLS may deny for some roles — same 0-row contract as the rest. */
export async function updateFollowUp(
  clientId: string,
  followUpId: string,
  expectedStatus: string,
  action: 'done' | 'snooze1d' | 'snooze3d' | 'cancel',
): Promise<WriteResult> {
  const now = Date.now()
  const patch: Record<string, unknown> =
    action === 'done'
      ? { status: 'done', completed_at: new Date(now).toISOString() }
      : action === 'cancel'
        ? { status: 'cancelled' }
        : {
            status: 'snoozed',
            snoozed_until: new Date(
              now + (action === 'snooze1d' ? 24 : 72) * 3_600_000,
            ).toISOString(),
          }
  const { data, error } = await supabase
    .from('follow_ups')
    .update(patch)
    .eq('client_id', clientId)
    .eq('id', followUpId)
    .eq('status', expectedStatus)
    .select('id')
  return fromUpdate(data, error)
}

export async function addNote(
  clientId: string,
  row: {
    conversation_id: string | null
    lead_id: string | null
    author: string | null
    body: string
  },
): Promise<WriteResult> {
  const { data, error } = await supabase
    .from('conversation_notes')
    .insert({ client_id: clientId, ...row })
    .select('id')
  return fromUpdate(data, error)
}

export async function deleteNote(clientId: string, noteId: string): Promise<WriteResult> {
  const { data, error } = await supabase
    .from('conversation_notes')
    .delete()
    .eq('client_id', clientId)
    .eq('id', noteId)
    .select('id')
  return fromUpdate(data, error)
}
