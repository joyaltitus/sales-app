import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { QueueItem } from './inbox-data'

// Landing data layer (SA-03). Same laws as inbox-data.ts and leads-data.ts:
// plain PostgREST table reads, every query .eq('client_id', clientId)
// EXPLICITLY as well as under RLS, every list bounded.
//
// ⚠ SCOPE NOTE (§S5): every source below is a table the browser can ALREADY
// read under existing policy — conversations, turn_traces, contacts, all
// `client_id IN my_client_ids()`. `dead_letter` and `llm_usage_logs` are ops
// tables and are deliberately not touched. If a landing ever wants one, §S5
// rules that it is a separate src/api/ session with its own auth review: never
// a widened grant, never an elevated key, never faked.
//
// ("Elevated key" is a circumlocution on purpose: the proper name for that key
// is a forbidden substring under the law-8 tripwire in scripts/, which is a
// plain text-include check with no comment exemption. Prose promising NOT to
// use one still fails the build — including, on the first attempt here, a
// comment that merely cited the checker's own filename.)
//
// Most of what the landings need is DERIVED, not fetched. The conversation
// list already arrives via useQueue (bounded at 200, tenant-scoped); the
// helpers here are pure functions over it, so Today and Floor add no
// conversation query at all.
const TRACE_LIMIT = 400
const CONTACT_LIMIT = 300

/**
 * Is the customer waiting on us?
 *
 * True when their last message is newer than our last bot message — or when
 * they have written and the bot has never replied at all. A conversation with
 * no customer message is never "unanswered": there is nothing to answer.
 *
 * This is deliberately a two-column comparison done in JS rather than in the
 * query. PostgREST cannot compare two columns to each other without a view or
 * an RPC, and §0.3 rules both out for this app.
 */
export function isUnanswered(c: QueueItem): boolean {
  if (!c.last_customer_message_at) return false
  if (!c.last_bot_message_at) return true
  return new Date(c.last_customer_message_at) > new Date(c.last_bot_message_at)
}

/** Oldest customer message first — the one who has waited longest leads. */
export function byLongestWait(a: QueueItem, b: QueueItem): number {
  const ta = a.last_customer_message_at ? new Date(a.last_customer_message_at).getTime() : Infinity
  const tb = b.last_customer_message_at ? new Date(b.last_customer_message_at).getTime() : Infinity
  return ta - tb
}

/** Unanswered threads, longest wait first. The shared spine of Today and Floor. */
export function waitingLongest(items: QueueItem[]): QueueItem[] {
  return items.filter(isUnanswered).sort(byLongestWait)
}

/**
 * Escalations nobody has picked up.
 *
 * `bot_paused AND NOT escalation_resolved` is the ENGINE's own definition of an
 * open escalation, not a UI invention — hub-service maintains both columns and
 * Postgres indexes exactly this predicate
 * (`conversations_paused ON (bot_paused, escalation_resolved, paused_at) WHERE bot_paused`).
 * Using the engine's definition means the manager's floor view and the engine
 * can never disagree about what is outstanding.
 */
export function unpickedEscalations(items: QueueItem[]): QueueItem[] {
  return items.filter((c) => c.bot_paused && !c.escalation_resolved).sort(byLongestWait)
}

/** Paused threads, whatever the reason — Health's first question. */
export function pausedThreads(items: QueueItem[]): QueueItem[] {
  return items.filter((c) => c.bot_paused).sort(byLongestWait)
}

/** Follow-ups landing today or already overdue. Anything further out is not
 *  today's problem and Today does not show it. */
export function dueToday<T extends { due_at: string }>(items: T[], now: number = Date.now()): T[] {
  const end = new Date(now)
  end.setHours(23, 59, 59, 999)
  return items.filter((f) => new Date(f.due_at).getTime() <= end.getTime())
}

export function isOverdue(due_at: string, now: number = Date.now()): boolean {
  return new Date(due_at).getTime() < now
}

/**
 * The most recent trace route per conversation.
 *
 * Same shape as usePreviews: ONE bounded read ordered newest-first, reduced to
 * the first hit per conversation, rather than a query per row. TRACE_LIMIT is a
 * deliberate ceiling — a conversation whose newest trace falls outside it
 * simply has no entry here, which degrades to "not shown on Health" rather than
 * to an error.
 *
 * TRACE-ATTRIBUTION-F (STATE.md, open): some turn_traces rows carry NULL
 * conversation_id / client_id and are invisible under RLS. Those rows cannot
 * appear here, which is the same degradation the Inbox seam already accepts.
 */
export function useLatestTraceRoutes(clientId: string | null) {
  const [routes, setRoutes] = useState<Map<string, { route: string; created_at: string }>>(
    new Map(),
  )
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!clientId) {
      setRoutes(new Map())
      setLoading(false)
      return
    }
    const { data } = await supabase
      .from('turn_traces')
      .select('conversation_id, route, created_at')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(TRACE_LIMIT)

    const next = new Map<string, { route: string; created_at: string }>()
    for (const row of (data ?? []) as {
      conversation_id: string | null
      route: string
      created_at: string
    }[]) {
      if (!row.conversation_id) continue
      // Newest-first, so the first hit per conversation is the latest one.
      if (next.has(row.conversation_id)) continue
      next.set(row.conversation_id, { route: row.route, created_at: row.created_at })
    }
    setRoutes(next)
    setLoading(false)
  }, [clientId])

  useEffect(() => {
    setLoading(true)
    void load()
  }, [load])

  return { routes, loading, reload: load }
}

export type OptedOutContact = {
  id: string
  profile_name: string | null
  channel: string
  external_id: string
}

/** Contacts who have opted out. A plain flag on a table the browser already
 *  reads — no ops table, no derived state. */
export function useOptedOutContacts(clientId: string | null) {
  const [items, setItems] = useState<OptedOutContact[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!clientId) {
      setItems([])
      setLoading(false)
      return
    }
    const { data } = await supabase
      .from('contacts')
      .select('id, profile_name, channel, external_id')
      .eq('client_id', clientId)
      .eq('is_opted_out', true)
      .order('created_at', { ascending: false })
      .limit(CONTACT_LIMIT)

    setItems((data ?? []) as OptedOutContact[])
    setLoading(false)
  }, [clientId])

  useEffect(() => {
    setLoading(true)
    void load()
  }, [load])

  return { items, loading, reload: load }
}
