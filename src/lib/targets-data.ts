import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'

// Targets data layer (WIRE session). Same conventions as leads-data.ts /
// todos-data.ts: plain PostgREST reads + one scoped upsert, RLS underneath
// (employee_targets_write policy: manager/client_admin only — a rep can read
// their own row via employee_targets_select but never write one).
const TARGET_LIMIT = 200

export type TargetItem = {
  id: string
  client_id: string
  user_id: string
  month: string
  target_value: number
  incentive_per_won: number
  bonus_at_target: number
  created_by: string
  created_at: string
  updated_at: string
}

const TARGET_COLUMNS =
  'id, client_id, user_id, month, target_value, incentive_per_won, bonus_at_target, created_by, created_at, updated_at'

/** First-of-month date string (YYYY-MM-01) — the shape `employee_targets.month`
 *  requires (`employee_targets_month_is_first` CHECK constraint). */
export function firstOfMonth(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}-01`
}

/** Nothing in this product is a hundred-million-rupee monthly target; a number
 *  that large is a typo or a paste, not an intent. */
const MONEY_MAX = 100_000_000

/** Targets are money. Refuse anything that is not a finite, non-negative number
 *  BEFORE it reaches the upsert — a NaN here would land as a real target.
 *
 *  Lives beside the upsert rather than in a screen because BOTH target editors
 *  (TargetsPage and the Todos SetTargetForm) write the same row through the same
 *  `client_id,user_id,month` conflict target: one of them coercing junk to 0
 *  silently zeroes a rep's month.
 *
 *  Returns null for empty, so callers decide whether blank means "no change" or
 *  "zero" — it never decides that for them.
 */
export function parseMoney(raw: string): number | null {
  if (raw.trim() === '') return null
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0 || n > MONEY_MAX) return null
  return Math.round(n)
}

export async function readOwnTarget(clientId: string, userId: string, month: string) {
  return supabase
    .from('employee_targets')
    .select(TARGET_COLUMNS)
    .eq('client_id', clientId)
    .eq('user_id', userId)
    .eq('month', month)
    .maybeSingle()
}

/** The rep's own current-month target row, or null when the manager hasn't
 *  set one yet. */
export function useTarget(clientId: string | null, userId: string | null, month: string) {
  const [item, setItem] = useState<TargetItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!clientId || !userId) {
      setItem(null)
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error: err } = await readOwnTarget(clientId, userId, month)
    if (err) {
      setItem(null)
      setError(err.message)
      setLoading(false)
      return
    }
    setError(null)
    setItem((data as TargetItem | null) ?? null)
    setLoading(false)
  }, [clientId, userId, month])

  useEffect(() => {
    void load()
  }, [load])

  return { item, loading, error, reload: load }
}

/** Revenue won by this rep in the same month as their target. Both tenant and owner filters are
 * explicit even though RLS remains underneath; this surface is personal progress, not a team view. */
export function useOwnWonValue(clientId: string | null, userId: string | null, month: string) {
  const [value, setValue] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const request = useRef(0)

  const load = useCallback(async () => {
    const generation = ++request.current
    if (!clientId || !userId) {
      setValue(0)
      setError(null)
      setLoading(false)
      return
    }
    // Built directly in UTC (not `new Date(`${month}T00:00:00`)`, which parses in local time and
    // shifts the window on any non-UTC offset) since `updated_at` is compared as UTC below.
    const [y, m] = month.split('-').map(Number)
    const start = new Date(Date.UTC(y, m - 1, 1)).toISOString()
    const end = new Date(Date.UTC(y, m, 1)).toISOString()
    setLoading(true)
    await supabase
      .from('leads')
      .select('est_value')
      .eq('client_id', clientId)
      .eq('owner_id', userId)
      .eq('status', 'won')
      // `leads` has no `won_at`; `updated_at` is the documented won-at proxy (src/metrics/queries.ts,
      // DashboardScreen) — do not swap this for a real won-at column without updating both.
      .gte('updated_at', start)
      .lt('updated_at', end)
      .then(({ data, error: err }) => {
        if (generation !== request.current) return
        setError(err?.message ?? null)
        setValue(err ? 0 : (data ?? []).reduce((sum, row) => sum + Number((row as { est_value: number | null }).est_value ?? 0), 0))
        setLoading(false)
      })
  }, [clientId, month, userId])

  useEffect(() => {
    void load()
    return () => { request.current += 1 }
  }, [load])

  return { value, loading, error, reload: load }
}

/** Every rep's target row for the client/month — feeds the manager set-target
 *  form and the team-load summary. */
export function useTeamTargets(clientId: string | null, month: string) {
  const [items, setItems] = useState<TargetItem[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!clientId) {
      setItems([])
      setLoading(false)
      return
    }
    setLoading(true)
    const { data } = await supabase
      .from('employee_targets')
      .select(TARGET_COLUMNS)
      .eq('client_id', clientId)
      .eq('month', month)
      .limit(TARGET_LIMIT)
    setItems((data ?? []) as TargetItem[])
    setLoading(false)
  }, [clientId, month])

  useEffect(() => {
    void load()
  }, [load])

  return { items, loading, reload: load }
}

/** Manager-only create/replace of a rep's monthly target. `employee_targets`
 *  has a UNIQUE(client_id, user_id, month) constraint, so this is a real
 *  upsert on conflict rather than an insert-then-update dance. */
export async function upsertTarget({
  clientId,
  userId,
  month,
  targetValue,
  incentivePerWon,
  bonusAtTarget,
  createdBy,
}: {
  clientId: string
  userId: string
  month: string
  targetValue: number
  incentivePerWon: number
  bonusAtTarget: number
  createdBy: string
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.from('employee_targets').upsert(
    {
      client_id: clientId,
      user_id: userId,
      month,
      target_value: targetValue,
      incentive_per_won: incentivePerWon,
      bonus_at_target: bonusAtTarget,
      created_by: createdBy,
    },
    { onConflict: 'client_id,user_id,month' },
  )
  if (error) return { ok: false, message: error.message }
  return { ok: true }
}
