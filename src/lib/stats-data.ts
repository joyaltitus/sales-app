import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

// Aggregate stats layer (WIRE session). Same laws as inbox-data.ts /
// leads-data.ts: plain PostgREST reads under RLS, bounded lists, no RPCs, no
// server-side rollup tables. These are fresh, narrowly-filtered queries
// against tables the app already reads elsewhere (messages, follow_ups,
// conversations, leads) — not new tables and not a duplicate of an existing
// hook's shape, since none of the existing hooks carry per-rep/day filters.
//
// GAP (see final report): `messages` carries no sender/user_id column — a
// reply cannot be attributed to a specific rep directly. `repliesToday` and
// `responseTrend` are therefore scoped via the rep's ASSIGNED CONVERSATIONS
// (conversations.assigned_to), the same ownership signal RLS itself uses for
// leads/lead_facts. This is an approximation, not per-message attribution.
const CONVERSATION_LIMIT = 300
const DONE_FOLLOW_UP_LIMIT = 500
const STREAK_LOOKBACK_DAYS = 30
const WON_LEAD_LIMIT = 500

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
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export type RepDailyStats = {
  repliesToday: number
  followUpsDone: number
  followUpsPlanned: number
  streakDays: number
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
  streakDays: 0,
  responseTrend: null,
}

/** Today's follow-up + reply + streak picture for one rep, scoped through
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
    let streakDays = 0

    if (conversationIds.length > 0) {
      const todayStart = startOfDay().toISOString()
      const todayEnd = endOfDay().toISOString()
      const lookbackStart = startOfDay(
        new Date(Date.now() - STREAK_LOOKBACK_DAYS * 86_400_000),
      ).toISOString()

      const [repliesRes, plannedRes, doneRecentRes] = await Promise.all([
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
          .select('completed_at')
          .eq('client_id', clientId)
          .in('conversation_id', conversationIds)
          .eq('status', 'done')
          .gte('completed_at', lookbackStart)
          .limit(DONE_FOLLOW_UP_LIMIT),
      ])

      repliesToday = repliesRes.count ?? 0
      followUpsPlanned = plannedRes.count ?? 0

      const doneDates = ((doneRecentRes.data ?? []) as { completed_at: string | null }[])
        .map((r) => r.completed_at)
        .filter((v): v is string => !!v)
        .map((v) => new Date(v))

      const doneDayKeys = new Set(doneDates.map(dayKey))
      followUpsDone = doneDates.filter((d) => dayKey(d) === dayKey(new Date())).length

      // Streak: consecutive days with >=1 completed follow-up, counting back
      // from today (or from yesterday if nothing is done yet today).
      const cursor = new Date()
      if (!doneDayKeys.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1)
      while (doneDayKeys.has(dayKey(cursor))) {
        streakDays += 1
        cursor.setDate(cursor.getDate() - 1)
      }
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

    setStats({ repliesToday, followUpsDone, followUpsPlanned, streakDays, responseTrend })
    setLoading(false)
  }, [clientId, userId])

  useEffect(() => {
    void load()
  }, [load])

  return { stats, loading, reload: load }
}

export type RepWinRow = { userId: string; name: string; won: number }

/**
 * Team-wins leaderboard infrastructure: won leads this month, grouped by the
 * rep the deal's conversation is assigned to. Mirrors DashboardScreen.tsx's
 * `real.won` computation (leads.status === 'won'), extended with a
 * conversations -> profiles walk for the per-rep attribution.
 *
 * No file in this session's edit list renders a leaderboard surface (there
 * is no existing SAMPLE-tagged leaderboard in the repo to kill — grepped
 * clean), so this hook is built and exported but left unconsumed. Flagged as
 * a GAP in the final report rather than wiring it into DashboardScreen.tsx,
 * which is out of this session's explicit file list.
 */
export function useTeamWinsThisMonth(clientId: string | null) {
  const [rows, setRows] = useState<RepWinRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!clientId) {
      setRows([])
      setLoading(false)
      return
    }
    setLoading(true)

    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)

    const [leadsRes, profilesRes] = await Promise.all([
      supabase
        .from('leads')
        .select('id, conversation_id, updated_at')
        .eq('client_id', clientId)
        .eq('status', 'won')
        .gte('updated_at', monthStart.toISOString())
        .limit(WON_LEAD_LIMIT),
      supabase.from('profiles').select('user_id, display_name').eq('client_id', clientId),
    ])

    const leadRows = (leadsRes.data ?? []) as { id: string; conversation_id: string | null }[]
    const conversationIds = Array.from(
      new Set(leadRows.map((l) => l.conversation_id).filter((v): v is string => !!v)),
    )

    let assignedByConversation = new Map<string, string>()
    if (conversationIds.length > 0) {
      const { data: convRows } = await supabase
        .from('conversations')
        .select('id, assigned_to')
        .eq('client_id', clientId)
        .in('id', conversationIds)
      assignedByConversation = new Map(
        ((convRows ?? []) as { id: string; assigned_to: string | null }[])
          .filter((r): r is { id: string; assigned_to: string } => !!r.assigned_to)
          .map((r) => [r.id, r.assigned_to]),
      )
    }

    const nameByUser = new Map(
      ((profilesRes.data ?? []) as { user_id: string; display_name: string }[]).map((p) => [
        p.user_id,
        p.display_name,
      ]),
    )

    const counts = new Map<string, number>()
    for (const lead of leadRows) {
      const repId = lead.conversation_id ? assignedByConversation.get(lead.conversation_id) : undefined
      if (!repId) continue
      counts.set(repId, (counts.get(repId) ?? 0) + 1)
    }

    const result: RepWinRow[] = Array.from(counts.entries())
      .map(([repId, won]) => ({ userId: repId, name: nameByUser.get(repId) ?? 'Unassigned', won }))
      .sort((a, b) => b.won - a.won)

    setRows(result)
    setLoading(false)
  }, [clientId])

  useEffect(() => {
    void load()
  }, [load])

  return { rows, loading, reload: load }
}
