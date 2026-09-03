import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import type { Trace } from './seam'
import type { LeadFact, FactCategory, FactState } from './mock-wave3'

// Inbox data layer. Plain PostgREST table reads only — no RPCs, no views, no
// edge functions (direction §0.3, the Workbench behaviour reference).
//
// Every query filters .eq('client_id', clientId) EXPLICITLY *and* sits under
// RLS. That belt-and-braces is deliberate: RLS is the wall, the explicit filter
// is what makes a query's tenant scope readable at the call site. Neither one
// is load-bearing alone and neither is a substitute for the other.
//
// Bounded lists, never infinite scroll (§1.10 #9): 200 conversations, 300
// messages, 300 traces — the same ceilings Workbench already uses.
const CONVERSATION_LIMIT = 200
const MESSAGE_LIMIT = 300
const TRACE_LIMIT = 300

// WhatsApp allows a free-text reply only inside 24 hours of the customer's last
// message; Instagram gives a human 7 days. Outside it, only a pre-approved
// template may open the conversation.
//
// The real gate is server-side (gate.js, pm_prepare_template_send) — this is the
// UX mirror, and it lives here rather than in a component because two screens
// read it: the context rail explains the closed window, and the composer offers
// the template that reopens it. Two copies of this arithmetic would eventually
// disagree, and the shape of that bug is a rep told the window is open by one
// panel while the other refuses to send.
export const WA_WINDOW_MS = 24 * 3_600_000
export const IG_HUMAN_WINDOW_MS = 7 * 24 * 3_600_000

/** No customer message at all counts as closed: there is no window to be inside. */
export function isWindowClosed(
  item: Pick<QueueItem, 'last_customer_message_at' | 'contact'>,
  now: number = Date.now(),
): boolean {
  const since = item.last_customer_message_at
    ? now - new Date(item.last_customer_message_at).getTime()
    : Infinity
  return since > (item.contact?.channel === 'instagram' ? IG_HUMAN_WINDOW_MS : WA_WINDOW_MS)
}

export type QueueItem = {
  id: string
  contact_id: string
  status: string
  bot_paused: boolean
  unread_count: number
  last_customer_message_at: string | null
  // SA-03 additions. The Inbox itself renders neither — the landings derive
  // from them (unanswered = customer newer than bot; unpicked escalation =
  // paused and unresolved). They are added to THIS select rather than fetched
  // by a second conversation query so the app keeps ONE conversation read
  // shape; a landing with its own divergent conversation query is the same
  // failure mode S4-AMENDMENT #1 warned about for row components.
  //
  // Exactly two columns, not four: `assigned_to` and `pause_reason` were also
  // added here and then removed, because nothing read them. A select that
  // fetches columns "in case a screen wants them" is how a read shape rots.
  last_bot_message_at: string | null
  escalation_resolved: boolean
  // SA-06: `assigned_to` — the "label" (Joyal's word) tying a conversation to
  // an employee; drives My-inbox scoping and the assignee chip.
  assigned_to: string | null
  // SA-05: `profile` (JSON) joined for the avatar; `is_opted_out` for the
  // context rail's send-window state. One read shape, same law as above.
  contact: {
    profile_name: string | null
    channel: string
    external_id: string
    profile: unknown
    is_opted_out: boolean
    captured_fields?: Record<string, unknown> | null
  } | null
  // Issue #18: the persisted AI summary. `rolling_summary` holds the last
  // server-generated summary text and `summary_upto` the conversation cut-off
  // it covers (both null while there is no summary). The AI Summary panel
  // hydrates from these on thread open and only generates on demand when they
  // are null or stale.
  rolling_summary: string | null
  summary_upto: string | null
  extracted_fields?: Record<string, unknown> | null
}

export type Message = {
  id: string
  sender_type: string
  direction: string
  body: string | null
  msg_type: string
  created_at: string
  media: unknown
  channel_message_id?: string | null
  delivery_status: string
  failure_reason: string | null
  transcription: string | null
}

/** A downloaded WhatsApp attachment, joined onto its message by
 *  `channel_message_id` (Part 6, #90 — the `inbound_media` table, not the
 *  unused `messages.media` jsonb column, which real inbound rows leave null). */
export type InboundMediaRow = {
  channel_message_id: string
  storage_bucket: string
  storage_path: string | null
  mime: string | null
  media_type: string
}

/** Time-limited signed URL for a private `inbound-media` object. RLS (both the
 *  bucket policy and the `inbound_media` table policy) scopes this to the
 *  caller's own client_id — a deny or network failure degrades to null, never
 *  a thrown error into a render. */
export async function getInboundMediaSignedUrl(storagePath: string): Promise<string | null> {
  const { data } = await supabase.storage.from('inbound-media').createSignedUrl(storagePath, 300)
  return data?.signedUrl ?? null
}

/** Supabase infers a to-one embed as an array; at runtime it is the single
 *  joined row. Normalize either shape (the same trap ClientProvider hit). */
function oneOf<T>(v: T | T[] | null): T | null {
  if (!v) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

/**
 * S1 (issue #15, AT-01..AT-08): an outbound message the browser sent but
 * hub-service has not yet persisted (the authoritative row is written only
 * after the send worker succeeds — see sendAgentMessage in lib/api.ts). The
 * `optimistic:` id prefix makes it collision-safe against real Postgres
 * UUIDs by construction, not by comparison.
 */
export type OptimisticBubble = {
  tempId: string
  body: string
  status: 'pending' | 'failed'
  createdAt: string
}

export function newOptimisticId(): string {
  return `optimistic:${crypto.randomUUID()}`
}

/**
 * Merge authoritative outbound messages with still-unreconciled optimistic
 * bubbles. Pure and recomputed every call — no "already claimed" state to
 * fall out of sync — so a refetch that lands before hub-service persists the
 * row just leaves the bubble unmatched (visible, pending) rather than
 * flickering it away.
 *
 * Matching is positional per body, not "any row with this body": the Nth
 * authoritative row with a given body claims the Nth still-pending bubble
 * with that body. That is what keeps two sequential identical-text sends
 * from collapsing into one bubble.
 */
export function mergeOutbound(authoritative: Message[], optimistic: OptimisticBubble[]): Message[] {
  const authByBody = new Map<string, Message[]>()
  for (const m of authoritative) {
    if (m.direction !== 'outbound') continue
    const key = m.body ?? ''
    const list = authByBody.get(key) ?? []
    list.push(m)
    authByBody.set(key, list)
  }
  const cursor = new Map<string, number>()
  const unmatched: Message[] = []
  for (const b of optimistic) {
    if (b.status === 'pending') {
      const list = authByBody.get(b.body) ?? []
      const idx = cursor.get(b.body) ?? 0
      if (idx < list.length) {
        cursor.set(b.body, idx + 1)
        continue
      }
    }
    unmatched.push({
      id: b.tempId,
      sender_type: 'agent',
      direction: 'outbound',
      body: b.body,
      msg_type: 'text',
      created_at: b.createdAt,
      media: null,
      delivery_status: b.status,
      failure_reason: b.status === 'failed' ? "Didn't send" : null,
      transcription: null,
    })
  }
  return [...authoritative, ...unmatched]
}

export function useQueue(clientId: string | null) {
  const [items, setItems] = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!clientId) {
      setItems([])
      setLoading(false)
      return
    }
    const { data, error: err } = await supabase
      .from('conversations')
      .select(
        'id, contact_id, status, bot_paused, unread_count, last_customer_message_at, last_bot_message_at, escalation_resolved, assigned_to, rolling_summary, summary_upto, extracted_fields, contacts ( profile_name, channel, external_id, profile, is_opted_out, captured_fields )',
      )
      .eq('client_id', clientId)
      .order('last_customer_message_at', { ascending: false, nullsFirst: false })
      .limit(CONVERSATION_LIMIT)

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }
    setError(null)
    setItems(
      (data ?? []).map((r) => {
        const row = r as unknown as Omit<QueueItem, 'contact'> & {
          contacts: QueueItem['contact'] | QueueItem['contact'][]
        }
        return { ...row, contact: oneOf(row.contacts) }
      }),
    )
    setLoading(false)
  }, [clientId])

  useEffect(() => {
    setLoading(true)
    void load()
  }, [load])

  useEffect(() => {
    if (typeof window === 'undefined' || !clientId) return
    const onConversationRead = (event: Event) => {
      const detail = (event as CustomEvent<{ clientId: string; conversationId: string }>).detail
      if (detail && detail.clientId === clientId) {
        setItems((prev) =>
          prev.map((item) =>
            item.id === detail.conversationId ? { ...item, unread_count: 0 } : item,
          ),
        )
      }
    }
    window.addEventListener('sa:conversation-read', onConversationRead)
    return () => window.removeEventListener('sa:conversation-read', onConversationRead)
  }, [clientId])

  return { items, loading, error, reload: load }
}

/**
 * Row previews. The queue row leads with the LAST INBOUND MESSAGE TEXT rather
 * than the name (§1.4), which `conversations` alone does not carry.
 *
 * One bounded read rather than a per-row query: the most recent inbound messages
 * client-wide, reduced to the newest per conversation. PREVIEW_LIMIT is a
 * deliberate ceiling, not a page-1 of infinite scroll (§1.10 #9) — a very long
 * tail conversation can fall outside it and simply renders without a preview
 * line, which degrades to the contact name rather than to an error.
 */
const PREVIEW_LIMIT = 600

export type PreviewKind = 'text' | 'image' | 'audio' | 'document' | 'other'

export type Preview = { text: string; kind: PreviewKind }

export function previewKind(msgType: string): PreviewKind {
  if (msgType === 'image') return 'image'
  if (msgType === 'audio') return 'audio'
  if (msgType === 'document') return 'document'
  if (msgType === 'text') return 'text'
  return 'other'
}

export function usePreviews(clientId: string | null) {
  const [previews, setPreviews] = useState<Map<string, Preview>>(new Map())

  const load = useCallback(async () => {
    if (!clientId) {
      setPreviews(new Map())
      return
    }
    const { data } = await supabase
      .from('messages')
      .select('conversation_id, body, transcription, msg_type, created_at')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(PREVIEW_LIMIT)

    const next = new Map<string, Preview>()
    for (const row of (data ?? []) as {
      conversation_id: string
      body: string | null
      transcription: string | null
      msg_type: string
    }[]) {
      // Rows arrive newest-first, so the first hit per conversation wins.
      if (next.has(row.conversation_id)) continue
      const kind = previewKind(row.msg_type)
      // A media-only row (no caption body, no transcript) gets a plain label
      // — the glyph in QueueRow carries the "this is media" signal, so the
      // text itself doesn't need to fake a caption.
      const text =
        row.body ??
        row.transcription ??
        (kind === 'image' ? 'Photo' : kind === 'audio' ? 'Voice note' : kind === 'document' ? 'Document' : `[${row.msg_type}]`)
      next.set(row.conversation_id, { text, kind })
    }
    setPreviews(next)
  }, [clientId])

  useEffect(() => {
    void load()
  }, [load])

  return { previews, reload: load }
}

export function useThread(clientId: string | null, conversationId: string | null) {
  const [messages, setMessages] = useState<Message[]>([])
  const [traces, setTraces] = useState<Trace[]>([])
  const [media, setMedia] = useState<Map<string, InboundMediaRow>>(new Map())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!clientId || !conversationId) {
      setMessages([])
      setTraces([])
      setMedia(new Map())
      setError(null)
      setLoading(false)
      return
    }
    setError(null)
    // Three independent reads, issued together — none depends on another.
    const [msgRes, traceRes, mediaRes] = await Promise.all([
      supabase
        .from('messages')
        .select(
          'id, sender_type, direction, body, msg_type, created_at, media, channel_message_id, delivery_status, failure_reason, transcription',
        )
        .eq('client_id', clientId)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .limit(MESSAGE_LIMIT),
      supabase
        .from('turn_traces')
        .select('id, route, matched_rule_key, created_at')
        .eq('client_id', clientId)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(TRACE_LIMIT),
      supabase
        .from('inbound_media')
        .select('channel_message_id, storage_bucket, storage_path, mime, media_type')
        .eq('client_id', clientId)
        .eq('conversation_id', conversationId)
        .limit(MESSAGE_LIMIT),
    ])

    if (msgRes.error) {
      setMessages([])
      setTraces([])
      setMedia(new Map())
      setError(msgRes.error.message)
      setLoading(false)
      return
    }

    setMessages((msgRes.data ?? []) as Message[])
    // TRACE-ATTRIBUTION-F (STATE.md, open): 24 rows carry NULL conversation_id /
    // client_id since 07-26 and are therefore invisible under RLS. A thread whose
    // traces are missing simply renders no seam — never an error, never a
    // placeholder (spec: "the seam must degrade to nothing when the trace is
    // absent"). So a failed or empty trace read is not an error path here.
    setTraces((traceRes.data ?? []) as Trace[])
    // Same degrade rule as traces: most historical media messages have no
    // matching inbound_media row yet (ingestion gap, #22/#33) — that renders
    // the existing [msg_type] placeholder, never an error.
    setMedia(
      new Map(
        ((mediaRes.data ?? []) as InboundMediaRow[]).map((row) => [row.channel_message_id, row]),
      ),
    )
    setLoading(false)
  }, [clientId, conversationId])

  useEffect(() => {
    if (conversationId) setLoading(true)
    void load()
  }, [load, conversationId])

  return { messages, traces, media, loading, error, reload: load, setMessages }
}

/**
 * Live updates. SEED-01 proved `supabase_realtime` already publishes
 * `conversations` and `messages` (its only two rows), so no ALTER PUBLICATION and
 * no /migration was needed here.
 *
 * The danger SEED-01 named explicitly: a channel that RLS or a missing
 * publication filters to zero rows is VISUALLY IDENTICAL to "no new messages".
 * So this hook does not trust the channel. It refetches on a SUBSCRIBED channel's
 * events AND on window focus AND on a slow interval, so a silently-dead channel
 * degrades to polling instead of to a frozen screen.
 */
export function useLiveRefresh(
  clientId: string | null,
  onChange: () => void,
  /** S1 (issue #15): the raw inserted `messages` row, delivered synchronously
   *  — not behind the 400ms debounce below — so the currently-open thread can
   *  paint an inbound message immediately instead of waiting on a full
   *  queue+preview+thread refetch. `ping()` still runs afterwards so queue
   *  ordering and unread counts reconcile in the background. */
  onMessageInsert?: (row: Message & { conversation_id: string; client_id: string }) => void,
) {
  const cb = useRef(onChange)
  cb.current = onChange
  const insertCb = useRef(onMessageInsert)
  insertCb.current = onMessageInsert
  const [channelLive, setChannelLive] = useState(false)

  useEffect(() => {
    if (!clientId) return
    let timer: ReturnType<typeof setTimeout> | null = null
    // Debounced so a burst of inserts causes one refetch, not one per row
    // (Workbench uses 400ms; same here).
    const ping = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => cb.current(), 400)
    }

    // Channel identity is the TENANT, not the open thread. Both listeners filter
    // on client_id alone, so folding the conversation id into the name would tear
    // the socket down and rebuild it on every row click for no change in what is
    // delivered. The refetch callback is held in a ref, so it always sees the
    // currently-open thread without resubscribing.
    const channel = supabase
      .channel(`inbox-${clientId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations', filter: `client_id=eq.${clientId}` },
        ping,
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `client_id=eq.${clientId}` },
        (payload) => {
          insertCb.current?.(payload.new as Message & { conversation_id: string; client_id: string })
          ping()
        },
      )
      .subscribe((status) => setChannelLive(status === 'SUBSCRIBED'))

    const onFocus = () => cb.current()
    window.addEventListener('focus', onFocus)
    // The fallback poll. 30s per spec; cheap against 200 bounded rows, and it is
    // what makes a dead channel merely slow instead of invisible.
    const poll = setInterval(() => cb.current(), 30_000)

    return () => {
      if (timer) clearTimeout(timer)
      window.removeEventListener('focus', onFocus)
      clearInterval(poll)
      void supabase.removeChannel(channel)
    }
  }, [clientId])

  return { channelLive }
}

function inferCategory(key: string): FactCategory {
  const k = key.toLowerCase()
  if (k.includes('budget') || k.includes('fee') || k.includes('price')) return 'budget'
  if (k.includes('pref') || k.includes('batch') || k.includes('time') || k.includes('schedule')) return 'preference'
  if (k.includes('object') || k.includes('concern') || k.includes('doubt')) return 'objection'
  if (k.includes('promis') || k.includes('commit')) return 'promise'
  if (k.includes('signal') || k.includes('intent') || k.includes('interest')) return 'buying_signal'
  if (k.includes('follow')) return 'follow_up'
  return 'requirement'
}

function formatFactLabel(key: string): string {
  return key
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
}

/**
 * Parse real per-conversation extracted facts and contact captured fields
 * into LeadFact objects for the Customer Memory panel (sales-app#21 S2).
 */
export function parseFacts(item: QueueItem): LeadFact[] {
  const facts: LeadFact[] = []
  const rawExtracted = item.extracted_fields
  const rawCaptured = item.contact?.captured_fields
  const defaultChannel: 'whatsapp' | 'instagram' =
    item.contact?.channel === 'instagram' ? 'instagram' : 'whatsapp'
  const defaultAt = item.last_customer_message_at || new Date().toISOString()

  const addFact = (
    key: string,
    val: unknown,
    sourceChannel: 'whatsapp' | 'instagram' = defaultChannel,
  ) => {
    if (val == null) return
    if (typeof val === 'object' && !Array.isArray(val)) {
      const obj = val as Record<string, unknown>
      const valueStr = String(obj.value ?? obj.text ?? JSON.stringify(obj))
      if (!valueStr.trim()) return
      const cat = (obj.category as FactCategory) || inferCategory(key)
      const st = (obj.state as FactState) || 'confirmed'
      facts.push({
        id: `fact-${item.id}-${key}`,
        category: cat,
        label: formatFactLabel(key),
        value: valueStr,
        state: st,
        confidence: typeof obj.confidence === 'number' ? obj.confidence : 0.9,
        evidence: {
          quote: typeof obj.quote === 'string' ? obj.quote : valueStr,
          channel: (obj.channel as 'whatsapp' | 'instagram') || sourceChannel,
          at: typeof obj.at === 'string' ? obj.at : defaultAt,
        },
      })
    } else if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
      const valueStr = String(val).trim()
      if (!valueStr) return
      facts.push({
        id: `fact-${item.id}-${key}`,
        category: inferCategory(key),
        label: formatFactLabel(key),
        value: valueStr,
        state: 'confirmed',
        confidence: 0.9,
        evidence: {
          quote: valueStr,
          channel: sourceChannel,
          at: defaultAt,
        },
      })
    }
  }

  if (rawExtracted && typeof rawExtracted === 'object') {
    if (Array.isArray(rawExtracted)) {
      rawExtracted.forEach((f, idx) => addFact(`extracted_${idx}`, f))
    } else {
      Object.entries(rawExtracted).forEach(([k, v]) => addFact(k, v))
    }
  }

  if (rawCaptured && typeof rawCaptured === 'object') {
    if (Array.isArray(rawCaptured)) {
      rawCaptured.forEach((f, idx) => addFact(`captured_${idx}`, f))
    } else {
      Object.entries(rawCaptured).forEach(([k, v]) => {
        if (
          !facts.some(
            (existing) => existing.label.toLowerCase() === formatFactLabel(k).toLowerCase(),
          )
        ) {
          addFact(k, v)
        }
      })
    }
  }

  return facts
}
