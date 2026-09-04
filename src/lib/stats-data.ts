import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

// Aggregate stats layer (WIRE session). Same laws as inbox-data.ts /
// leads-data.ts: plain PostgREST reads under RLS, bounded lists, no RPCs, no
// server-side rollup tables. These are fresh, narrowly-filtered queries
// against tables the app already reads elsewhere (messages, follow_ups and
// conversations) — not new tables and not a duplicate of an existing
// hook's shape, since none of the existing hooks carry per-rep/day filters.
//
// GAP (see final report): `messages` carries no sender/user_id column — a
// reply cannot be attributed to a specific rep directly. `repliesToday` and
// `responseTrend` are therefore scoped via the rep's ASSIGNED CONVERSATIONS
// (conversations.assigned_to), the same ownership signal RLS itself uses for
// leads/lead_facts. This is an approximation, not per-message attribution.
const CONVERSATION_LIMIT = 300

function startOfDay(d: Date = new Date()): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}
function endOfDay(d: Date = new Date()): Date {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}
export type RepDailyStats = {
  repliesToday: number
  followUpsDone: number
  followUpsPlanned: number
  /** Human sentence, or null when there isn't enough data yet (no reply
   *  pairs in the rep's currently open conversations). Deliberately does NOT
   *  compare to "last week" — that needs a second historical query this
   *  session doesn't add; see GAP note in the final report. */
  responseTrend: string | null
}

const EMPTY_STATS: RepDailyStats = {
  repliesToday: 0,
  followUpsDone: 0,
  followUpsPlanned: 0,
  responseTrend: null,
}

/** Today's follow-up and reply picture for one rep, scoped through
 *  their assigned conversations. Read-only, no new tables. */
export function useRepDailyStats(clientId: string | null, userId: string | null) {
  const [stats, setStats] = useState<RepDailyStats>(EMPTY_STATS)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!clientId || !userId) {
      setStats(EMPTY_STATS)
      setLoading(false)
      return
    }
    setLoading(true)

    const { data: convRows } = await supabase
      .from('conversations')
      .select('id, last_customer_message_at, last_bot_message_at')
      .eq('client_id', clientId)
      .eq('assigned_to', userId)
      .limit(CONVERSATION_LIMIT)

    const conversations = (convRows ?? []) as {
      id: string
      last_customer_message_at: string | null
      last_bot_message_at: string | null
    }[]
    const conversationIds = conversations.map((c) => c.id)

    let repliesToday = 0
    let followUpsPlanned = 0
    let followUpsDone = 0

    if (conversationIds.length > 0) {
      const todayStart = startOfDay().toISOString()
      const todayEnd = endOfDay().toISOString()
      const [repliesRes, plannedRes, doneRes] = await Promise.all([
        supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', clientId)
          .eq('direction', 'outbound')
          .in('conversation_id', conversationIds)
          .gte('created_at', todayStart)
          .lte('created_at', todayEnd),
        supabase
          .from('follow_ups')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', clientId)
          .in('conversation_id', conversationIds)
          .in('status', ['pending', 'snoozed'])
          .gte('due_at', todayStart)
          .lte('due_at', todayEnd),
        supabase
          .from('follow_ups')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', clientId)
          .in('conversation_id', conversationIds)
          .eq('status', 'done')
          .gte('completed_at', todayStart)
          .lte('completed_at', todayEnd),
      ])

      repliesToday = repliesRes.count ?? 0
      followUpsPlanned = plannedRes.count ?? 0
      followUpsDone = doneRes.count ?? 0
    }

    const gaps = conversations
      .map((c) => {
        if (!c.last_customer_message_at || !c.last_bot_message_at) return null
        const diffMin =
          (new Date(c.last_bot_message_at).getTime() - new Date(c.last_customer_message_at).getTime()) / 60_000
        return diffMin >= 0 ? diffMin : null
      })
      .filter((v): v is number => v != null)
      .sort((a, b) => a - b)

    let responseTrend: string | null = null
    if (gaps.length > 0) {
      const mid = Math.floor(gaps.length / 2)
      const median = gaps.length % 2 ? gaps[mid] : (gaps[mid - 1] + gaps[mid]) / 2
      responseTrend = `Median reply ${Math.round(median)} min`
    }

    setStats({ repliesToday, followUpsDone, followUpsPlanned, responseTrend })
    setLoading(false)
  }, [clientId, userId])

  useEffect(() => {
    void load()
  }, [load])

  return { stats, loading, reload: load }
}
