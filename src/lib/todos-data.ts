import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

// Todos data layer (WIRE session). Mirrors leads-data.ts conventions: plain
// PostgREST reads (+ scoped writes) via the `supabase` client, no RPCs, no
// views, no edge functions. Every read filters .eq('client_id', clientId)
// explicitly *and* sits under RLS (migration 045_wave2_ddl_foundation.sql).
//
// `employee_todos.assignee` and `.created_by` carry NO foreign key to
// `profiles` (checked in the migration DDL — plain `uuid NOT NULL` columns),
// so a PostgREST embed hint (`profiles ( display_name )`) cannot resolve the
// relationship. Names are joined client-side instead: `profiles` is fetched
// once per client and matched onto rows by user_id.
const TODO_LIMIT = 300
const PROFILE_LIMIT = 200

export type TodoStatus = 'pending' | 'done'

export type TodoItem = {
  id: string
  client_id: string
  title: string
  assignee: string
  assigneeName: string | null
  due_at: string | null
  status: TodoStatus
  source: string
  ref_id: string | null
  note: string | null
  created_by: string
  createdByName: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export type ProfileItem = { user_id: string; display_name: string }

/** Roster for the active client — real `profiles` rows (display name +
 *  user_id), used for the assignee picker and the "todos by rep" grouping.
 *  Replaces the old `TODO_REPS` sample fixture. */
export function useProfiles(clientId: string | null) {
  const [items, setItems] = useState<ProfileItem[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!clientId) {
      setItems([])
      setLoading(false)
      return
    }
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('user_id, display_name')
      .eq('client_id', clientId)
      .order('display_name', { ascending: true })
      .limit(PROFILE_LIMIT)
    setItems((data ?? []) as ProfileItem[])
    setLoading(false)
  }, [clientId])

  useEffect(() => {
    void load()
  }, [load])

  return { items, loading, reload: load }
}

export function useTodos(clientId: string | null) {
  const [items, setItems] = useState<TodoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!clientId) {
      setItems([])
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const [todosRes, profilesRes] = await Promise.all([
      supabase
        .from('employee_todos')
        .select(
          'id, client_id, title, assignee, due_at, status, source, ref_id, note, created_by, completed_at, created_at, updated_at',
        )
        .eq('client_id', clientId)
        .order('due_at', { ascending: true, nullsFirst: false })
        .limit(TODO_LIMIT),
      supabase.from('profiles').select('user_id, display_name').eq('client_id', clientId).limit(PROFILE_LIMIT),
    ])

    if (todosRes.error) {
      setItems([])
      setError(todosRes.error.message)
      setLoading(false)
      return
    }
    setError(null)
    const nameByUser = new Map(
      ((profilesRes.data ?? []) as ProfileItem[]).map((p) => [p.user_id, p.display_name]),
    )
    setItems(
      ((todosRes.data ?? []) as Omit<TodoItem, 'assigneeName' | 'createdByName'>[]).map((row) => ({
        ...row,
        status: row.status as TodoStatus,
        assigneeName: nameByUser.get(row.assignee) ?? null,
        createdByName: nameByUser.get(row.created_by) ?? null,
      })),
    )
    setLoading(false)
  }, [clientId])

  useEffect(() => {
    void load()
  }, [load])

  return { items, loading, error, reload: load }
}

/**
 * Create a todo. `employee_todos.assignee` is a single uuid column — the
 * compose UI's multi-select fans out to ONE insert row per selected
 * assignee, sharing the same title/due_at/created_by (locked decision, no
 * DDL change). Returns the created ids so the caller can key any
 * client-side-only display state (e.g. priority — see note below) against
 * real rows.
 */
export async function createTodo({
  clientId,
  title,
  assigneeIds,
  dueAt,
  createdBy,
  note,
}: {
  clientId: string
  title: string
  assigneeIds: string[]
  dueAt: string | null
  createdBy: string
  note?: string | null
}): Promise<{ ok: true; ids: string[] } | { ok: false; message: string }> {
  if (!title.trim()) return { ok: false, message: 'Title is required.' }
  if (!assigneeIds.length) return { ok: false, message: 'Select at least one assignee.' }

  const rows = assigneeIds.map((assignee) => ({
    client_id: clientId,
    title: title.trim(),
    assignee,
    due_at: dueAt,
    created_by: createdBy,
    note: note ?? null,
  }))

  const { data, error } = await supabase.from('employee_todos').insert(rows).select('id')
  if (error) return { ok: false, message: error.message }
  return { ok: true, ids: ((data ?? []) as { id: string }[]).map((r) => r.id) }
}

/**
 * Toggle pending <-> done. Scoped update, mirrors moveLeadStage: an empty
 * result means RLS filtered the row (denied), not an error. `completed_at`
 * is set/cleared alongside status.
 */
export async function toggleTodo(
  clientId: string,
  id: string,
  nextStatus: TodoStatus,
): Promise<{ ok: true } | { ok: false; reason: 'denied' | 'error'; message?: string }> {
  const { data, error } = await supabase
    .from('employee_todos')
    .update({
      status: nextStatus,
      completed_at: nextStatus === 'done' ? new Date().toISOString() : null,
    })
    .eq('client_id', clientId)
    .eq('id', id)
    .select('id')

  if (error) return { ok: false, reason: 'error', message: error.message }
  if (!data || data.length === 0) return { ok: false, reason: 'denied' }
  return { ok: true }
}
