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
  kind:
    | 'log_outcome' | 'save_lead' | 'add_note' | 'add_follow_up' | 'update_follow_up'
    | 'log_objection' | 'create_lead'
    | 'script_used' | 'script_feedback' | 'playbook_gap' | 'save_spin' | 'delete_spin' | 'token_received'
  args: Record<string, unknown>
  created_at: string
  attempts: number
  last_error: string | null
}

export type Cached<T> = { data: T; fetched_at: string; scope?: string }
export type Snippet = { id: string; title: string; body: string; scope: 'personal' | 'shared' }
// ── Playbook (migration 068) ─────────────────────────────────────────────────
//
// `script_versions.body` is ONE jsonb document: the default-language paragraphs
// at the top level, every other dialect under `variants`. One row per script
// version, not one row per language — a dialect is a rewrite of the same
// script, never a different script.
export type ScriptParagraph = { before: string; highlight?: string | null; after?: string | null }
export type ScriptVariant = { paragraphs: ScriptParagraph[] }
export type ScriptBody = ScriptVariant & { lang?: string; variants?: Record<string, ScriptVariant> }

/** 'stage' rows are the call roadmap (position < 90) plus the composed texts
 *  looked up by key (position >= 90); 'objection' rows are the chip row. */
export type PlaybookKind = 'objection' | 'stage'

/** A rep's own rewrite of one script in one dialect (quick_replies, scope
 *  'personal'). Unique per (client, rep, script, lang), so Save is an upsert
 *  rather than a growing pile. */
export type PersonalSpin = {
  id: string
  script_id: string
  lang: string
  title: string
  body: string
  updated_at: string
}

/**
 * One taxonomy row plus the script the rep should actually say — the single
 * shape the HUD, the chips, the sheet and the Library all read.
 *
 * Everything needed mid-call is on this object, because a second read mid-call
 * is a read that happens while somebody is talking.
 */
export type Rebuttal = {
  taxonomy_id: string
  taxonomy_key: string
  label: string
  kind: PlaybookKind
  position: number
  /** lucide icon name or an emoji: render lucide when the name resolves, else the text. */
  icon: string | null
  status: 'active' | 'archived'
  script_id: string | null
  script_version_id: string | null
  version: number | null
  created_at: string | null
  headline: string | null
  body: ScriptBody | null
  /** Dialects this script actually has: default lang first, then its variants. */
  langs: string[]
  uses: number
  rated: number
  won: number
  spin: PersonalSpin | null
}

/** items.sales_facts for a course. Every field optional: a missing fact must
 *  leave its {{token}} visible, never render as "undefined". */
export type CourseFacts = {
  fee?: number | string
  emi_monthly?: number | string
  emi_months?: number | string
  duration?: string
  batch_start?: string
  usp?: string
  proof?: string
  token_amount?: number | string
}

export type CourseItem = {
  id: string
  name: string
  category: string | null
  active: boolean
  sales_facts: CourseFacts | null
}

/** clients.sales_config — the workspace's payment and language setup. */
export type SalesConfig = {
  languages?: string[]
  default_lang?: string
  upi_vpa?: string
  upi_payee?: string
  pay_url?: string
  token_amount?: number | string
  token_note?: string
}

/** The one library payload: scripts, the courses their numbers come from, and
 *  the workspace payment config. Cached as a unit, scoped by client. */
export type PlaybookLibrary = {
  scripts: Rebuttal[]
  courses: CourseItem[]
  config: SalesConfig | null
  /** Every spin the viewer owns, across scripts and dialects. */
  spins: PersonalSpin[]
}
export type ChatMode = 'wa_me' | 'desktop'

export type TranscribeResponse =
  | { ok: true; transcript: string; provider: 'sarvam' | 'gemini'; degraded: boolean }
  | { ok: false; error: 'unauthorized' | 'forbidden' | 'bad_request' | 'budget_exceeded'
      | 'transcription_failed' | 'auth_unavailable' | 'db_unavailable' | 'disabled' }
