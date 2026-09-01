export type OwnerRef = { user_id: string; display_name: string | null }

export type QueueItem = {
  lead_id: string
  contact_id: string
  person_id: string | null
  display_name: string
  phone_e164: string | null
  channel: 'whatsapp' | 'instagram' | 'phone'
  stage_key: string
  stage_label: string
  status: 'open' | 'won' | 'lost'
  owner: OwnerRef | null            // COALESCE(leads.owner_id, conversations.assigned_to, leads.created_by)
  due_at: string | null             // ISO; null = no follow-up scheduled
  follow_up_id: string | null
  last_activity_at: string | null
  reason: 'due' | 'overdue' | 'new' | 'idle'
}

export type CallOutcome = 'closed' | 'progressing' | 'objection' | 'no_answer' | 'callback'
//   ^ the CHECK'd input space of pm_log_call_outcome. v1 adds NO sixth value.

export type TimelineEntry =
  | { kind: 'message'; at: string; direction: 'in' | 'out'; body: string | null; msg_type: string; source: 'api' }
  | { kind: 'call_log'; at: string; outcome: CallOutcome; note: string | null; source: 'rep' }
  | { kind: 'note'; at: string; body: string; author: OwnerRef | null; source: 'rep' }
  | { kind: 'objection'; at: string; taxonomy_key: string; label: string; source: 'api' | 'rep' }

export type LeadDetail = {
  lead: QueueItem
  facts: { id: string; kind: string; fact_key: string; value: unknown
           status: 'suggested' | 'confirmed'; confidence: number | null }[]
  objections: { id: string; taxonomy_key: string; label: string; occurred_at: string
                note: string | null; resolved_at: string | null }[]
  timeline: TimelineEntry[]         // union over person_id, newest first
  source: 'api' | 'rep' | 'both'
}

export type OutboxEntry = {
  id: string                        // client-minted uuid; this IS the idempotency handle
  kind: 'log_outcome' | 'save_lead' | 'add_note' | 'add_follow_up' | 'update_follow_up' | 'log_objection'
  args: Record<string, unknown>
  created_at: string
  attempts: number
  last_error: string | null
}

export type Cached<T> = { data: T; fetched_at: string; scope?: string }
export type Snippet = { id: string; title: string; body: string; scope: 'personal' | 'shared' }
export type Rebuttal = { script_version_id: string; taxonomy_key: string; headline: string | null
                         body: unknown; uses: number; won: number }
export type ChatMode = 'wa_me' | 'desktop'

export type TranscribeResponse =
  | { ok: true; transcript: string; provider: 'sarvam' | 'gemini'; degraded: boolean }
  | { ok: false; error: 'unauthorized' | 'forbidden' | 'bad_request' | 'budget_exceeded'
      | 'transcription_failed' | 'auth_unavailable' | 'db_unavailable' | 'disabled' }
