import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import type { Trace } from './seam'

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
  contact: { profile_name: string | null; channel: string; external_id: string } | null
}

export type Message = {
  id: string
  sender_type: string
  direction: string
  body: string | null
  msg_type: string
  created_at: string
  media: unknown
  delivery_status: string
  failure_reason: string | null
  transcription: string | null
}

/** Supabase infers a to-one embed as an array; at runtime it is the single
 *  joined row. Normalize either shape (the same trap ClientProvider hit). */
function oneOf<T>(v: T | T[] | null): T | null {
  if (!v) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
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
        'id, contact_id, status, bot_paused, unread_count, last_customer_message_at, last_bot_message_at, escalation_resolved, contacts ( profile_name, channel, external_id )',
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

export function usePreviews(clientId: string | null) {
  const [previews, setPreviews] = useState<Map<string, string>>(new Map())

  const load = useCallback(async () => {
    if (!clientId) {
      setPreviews(new Map())
      return
    }
    const { data } = await supabase
      .from('messages')
      .select('conversation_id, body, transcription, msg_type, created_at')
      .eq('client_id', clientId)
      .eq('direction', 'inbound')
      .order('created_at', { ascending: false })
      .limit(PREVIEW_LIMIT)

    const next = new Map<string, string>()
    for (const row of (data ?? []) as {
      conversation_id: string
      body: string | null
      transcription: string | null
      msg_type: string
    }[]) {
      // Rows arrive newest-first, so the first hit per conversation wins.
      if (next.has(row.conversation_id)) continue
      const text =
        row.body ??
        row.transcription ??
        (row.msg_type === 'image'
          ? 'sent a photo'
          : row.msg_type === 'audio'
            ? 'sent a voice note'
            : `sent ${row.msg_type}`)
      next.set(row.conversation_id, text)
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
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!clientId || !conversationId) {
      setMessages([])
      setTraces([])
      return
    }
    // Two independent reads, issued together — neither depends on the other.
    const [msgRes, traceRes] = await Promise.all([
      supabase
        .from('messages')
        .select(
          'id, sender_type, direction, body, msg_type, created_at, media, delivery_status, failure_reason, transcription',
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
    ])

    setMessages((msgRes.data ?? []) as Message[])
    // TRACE-ATTRIBUTION-F (STATE.md, open): 24 rows carry NULL conversation_id /
    // client_id since 07-26 and are therefore invisible under RLS. A thread whose
    // traces are missing simply renders no seam — never an error, never a
    // placeholder (spec: "the seam must degrade to nothing when the trace is
    // absent"). So a failed or empty trace read is not an error path here.
    setTraces((traceRes.data ?? []) as Trace[])
    setLoading(false)
  }, [clientId, conversationId])

  useEffect(() => {
    if (conversationId) setLoading(true)
    void load()
  }, [load, conversationId])

  return { messages, traces, loading, reload: load, setMessages }
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
export function useLiveRefresh(clientId: string | null, onChange: () => void) {
  const cb = useRef(onChange)
  cb.current = onChange
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
        ping,
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
