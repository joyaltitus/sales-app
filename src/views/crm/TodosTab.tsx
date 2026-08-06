import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  CalendarDays,
  Check,
  ChevronRight,
  CircleAlert,
  Clock3,
  ListTodo,
  Plus,
  RotateCcw,
  Send,
  Target,
  Users,
} from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { useClient } from '../../shell/ClientProvider'
import { Avatar } from '../../ui/Avatar'
import { Button } from '../../ui/Button'
import { Chip } from '../../ui/Chip'
import { EmptyState } from '../../ui/EmptyState'
import { ErrorState } from '../../ui/ErrorState'
import { Sheet } from '../../ui/Sheet'
import { Skeleton } from '../../ui/Skeleton'
import { useProfiles, useTodos, createTodo, toggleTodo } from '../../lib/todos-data'
import type { TodoItem, TodoStatus } from '../../lib/todos-data'
import { firstOfMonth, useTeamTargets, upsertTarget } from '../../lib/targets-data'
import { NextAction } from '../../ui/NextAction'

// WIRE session: employee_todos + employee_targets are real tables now (see
// migration 045_wave2_ddl_foundation.sql). This tab used to render
// TODO_PREVIEW_ITEMS / TODO_REPS (todoMocks.ts) behind a SampleBanner; both
// are gone from here (todoMocks.ts itself stays — src/views/preview/
// PreviewGallery.tsx still imports it for the style gallery).
//
// GAP: `employee_todos` has no priority column (checked the migration DDL —
// title/assignee/due_at/status/source/ref_id/note/created_by/completed_at,
// nothing else). Priority stays a client-side-only display concept: it's
// captured at compose time and held in `priorityById`, a plain in-memory map
// that seeds new rows created THIS session. It does not persist across a
// reload, another device, or another user's session — there is nowhere to
// write it. Rows loaded from the database (or from any other client) render
// with the default "normal" tone.

type TodoPriority = 'normal' | 'high' | 'urgent'

const PRIORITY_TONE: Record<TodoPriority, 'neutral' | 'warn' | 'danger'> = {
  normal: 'neutral',
  high: 'warn',
  urgent: 'danger',
}

function localDateValue(dayOffset: number) {
  const date = new Date()
  date.setDate(date.getDate() + dayOffset)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** Presentation shape the row/detail components render — derived from a real
 *  `TodoItem` plus this-session-only priority. */
type TodoView = {
  id: string
  title: string
  assigneeName: string
  dueLabel: string
  dueAt: string | null
  overdue: boolean
  priority: TodoPriority
  status: 'open' | 'done'
  createdByName: string
}

function formatDueLabel(dueAt: string | null, status: TodoStatus): { label: string; overdue: boolean } {
  if (!dueAt) return { label: status === 'done' ? 'Done' : 'No due date', overdue: false }
  const due = new Date(dueAt)
  const now = new Date()
  const time = due.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  const sameDay = due.toDateString() === now.toDateString()

  if (status === 'done') {
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    if (sameDay) return { label: 'Done today', overdue: false }
    if (due.toDateString() === yesterday.toDateString()) return { label: 'Done yesterday', overdue: false }
    return { label: `Done ${due.toLocaleDateString()}`, overdue: false }
  }

  const overdue = due.getTime() < now.getTime()
  if (overdue) {
    const diffH = Math.round((now.getTime() - due.getTime()) / 3_600_000)
    if (diffH < 1) return { label: 'Overdue', overdue: true }
    if (diffH < 24) return { label: `${diffH} hour${diffH === 1 ? '' : 's'} ago`, overdue: true }
    const diffD = Math.round(diffH / 24)
    return { label: `${diffD} day${diffD === 1 ? '' : 's'} ago`, overdue: true }
  }

  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (sameDay) return { label: `Today · ${time}`, overdue: false }
  if (due.toDateString() === tomorrow.toDateString()) return { label: `Tomorrow · ${time}`, overdue: false }
  return { label: `${due.toLocaleDateString()} · ${time}`, overdue: false }
}

function toView(item: TodoItem, priorityById: Record<string, TodoPriority>): TodoView {
  const { label, overdue } = formatDueLabel(item.due_at, item.status)
  return {
    id: item.id,
    title: item.title,
    assigneeName: item.assigneeName ?? 'Unassigned',
    dueLabel: label,
    dueAt: item.due_at,
    overdue,
    priority: priorityById[item.id] ?? 'normal',
    status: item.status === 'done' ? 'done' : 'open',
    createdByName: item.createdByName ?? 'Manager',
  }
}

function AssignmentRow({ item, onToggle, onOpen }: { item: TodoView; onToggle: () => void; onOpen: () => void }) {
  return (
    <article className={['rounded-lg border bg-surface p-3 shadow-elev-1', item.overdue && item.status === 'open' ? 'border-[color-mix(in_srgb,var(--danger)_30%,var(--border))]' : 'border-border'].join(' ')}>
      <div className="flex items-start gap-3">
        <button onClick={onToggle} aria-label={`Mark ${item.title} ${item.status === 'done' ? 'open' : 'done'}`} aria-pressed={item.status === 'done'} className={['mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-colors', item.status === 'done' ? 'border-success bg-success text-white' : 'border-border-strong text-transparent hover:border-success hover:bg-success-subtle hover:text-success'].join(' ')}><Check aria-hidden size={13} strokeWidth={2.4} /></button>
        <div className="min-w-0 flex-1"><h4 className={['text-xs font-semibold leading-relaxed', item.status === 'done' ? 'text-fg-subtle line-through' : 'text-fg'].join(' ')}>{item.title}</h4><div className="mt-2 flex flex-wrap items-center gap-1.5"><Chip tone={PRIORITY_TONE[item.priority]}>{item.priority}</Chip><span className={['text-2xs font-semibold', item.overdue && item.status === 'open' ? 'text-danger' : 'text-fg-muted'].join(' ')}>{item.overdue && item.status === 'open' ? 'Overdue · ' : ''}{item.dueLabel}</span></div></div>
      </div>
      <div className="mt-2"><NextAction compact label={item.status === 'done' ? 'No action — completed' : item.overdue ? 'Complete or reassign now' : `Complete by ${item.dueLabel}`} /></div>
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-2.5"><span className="flex items-center gap-1.5"><Avatar name={item.assigneeName} size="sm" /><span className="text-2xs font-semibold text-fg-muted">{item.assigneeName}</span></span><button onClick={onOpen} className="inline-flex min-h-8 items-center gap-1 rounded-md px-2 text-2xs font-semibold text-accent hover:bg-accent-subtle">View details <ChevronRight aria-hidden size={12} /></button></div>
    </article>
  )
}

function TodoDetail({ item, onToggle }: { item: TodoView; onToggle: () => void }) {
  return (
    <div className="space-y-5" data-testid="todo-details">
      <div>
        <div className="flex flex-wrap items-center gap-2"><Chip tone={PRIORITY_TONE[item.priority]}>{item.priority} priority</Chip><Chip tone={item.status === 'done' ? 'success' : item.overdue ? 'danger' : 'accent'}>{item.status === 'done' ? 'Completed' : item.overdue ? 'Overdue' : 'Open'}</Chip></div>
        <h3 className="mt-3 text-xl font-semibold leading-snug tracking-[-0.03em] text-fg">{item.title}</h3>
        <p className={['mt-2 flex items-center gap-1.5 text-xs font-semibold', item.overdue && item.status === 'open' ? 'text-danger' : 'text-fg-muted'].join(' ')}><Clock3 aria-hidden size={14} /> {item.dueLabel}</p>
      </div>

      <section className="rounded-lg border border-border bg-surface-sunk p-3">
        <p className="label-caps">Assigned to</p>
        <div className="mt-3 flex items-center gap-2"><Avatar name={item.assigneeName} size="sm" /><span className="text-xs font-semibold text-fg">{item.assigneeName}</span></div>
        <p className="mt-3 border-t border-border pt-3 text-2xs text-fg-muted">Created by <strong className="text-fg">{item.createdByName}</strong></p>
      </section>

      <section>
        <p className="label-caps text-accent">Next action</p>
        <div className="mt-2"><NextAction label={item.status === 'done' ? 'No action — this task is complete' : item.overdue ? 'Complete this now or ask the manager to reassign it' : `Complete this task by ${item.dueLabel}`} /></div>
      </section>

      <section>
        <p className="label-caps">Task activity</p>
        <ol className="mt-3 space-y-3 border-l border-border pl-4">
          <li><p className="text-xs font-semibold text-fg">Assigned by {item.createdByName}</p><p className="mt-0.5 text-2xs text-fg-muted">To {item.assigneeName}</p></li>
          <li><p className="text-xs font-semibold text-fg">Due {item.dueLabel}</p><p className="mt-0.5 text-2xs text-fg-muted">Priority set to {item.priority}</p></li>
          {item.status === 'done' && <li><p className="text-xs font-semibold text-success">Marked complete</p></li>}
        </ol>
      </section>

      <Button size="lg" className="w-full" onClick={onToggle}>{item.status === 'done' ? <RotateCcw aria-hidden size={15} /> : <Check aria-hidden size={15} />}{item.status === 'done' ? 'Reopen task' : 'Mark task done'}</Button>
    </div>
  )
}

function ComposeSheet({
  open,
  onClose,
  roster,
  onCreate,
}: {
  open: boolean
  onClose: () => void
  roster: { user_id: string; display_name: string }[]
  onCreate: (input: { title: string; assigneeIds: string[]; dueAt: string; priority: TodoPriority }) => void
}) {
  const [title, setTitle] = useState('')
  const [assigneeIds, setAssigneeIds] = useState<string[]>(() => (roster[0] ? [roster[0].user_id] : []))
  const [due, setDue] = useState<'Today' | 'Tomorrow' | 'Pick'>('Today')
  const [date, setDate] = useState(() => localDateValue(2))
  const [priority, setPriority] = useState<TodoPriority>('normal')

  useEffect(() => {
    if (!assigneeIds.length && roster[0]) setAssigneeIds([roster[0].user_id])
  }, [roster, assigneeIds.length])

  const create = () => {
    if (!title.trim() || !assigneeIds.length) return
    const dueDate = due === 'Today' ? localDateValue(0) : due === 'Tomorrow' ? localDateValue(1) : date
    onCreate({ title: title.trim(), assigneeIds, dueAt: `${dueDate}T17:00:00+05:30`, priority })
    setTitle('')
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title="Assign a todo">
      <label className="block"><span className="label-caps">Title</span><input value={title} onChange={(event) => setTitle(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) create() }} autoFocus placeholder="What needs to happen?" className="mt-2 h-11 w-full rounded-md border border-border bg-surface-raised px-3 text-sm text-fg placeholder:text-fg-subtle" /></label>
      <fieldset className="mt-5"><legend className="label-caps">Assign to</legend><div className="mt-2 grid grid-cols-2 gap-2">{roster.map((rep) => { const selected = assigneeIds.includes(rep.user_id); return <button type="button" key={rep.user_id} onClick={() => setAssigneeIds((all) => selected ? all.filter((id) => id !== rep.user_id) : [...all, rep.user_id])} aria-pressed={selected} className={['flex min-h-12 items-center gap-2 rounded-md border px-2.5 text-left', selected ? 'border-accent bg-accent-subtle' : 'border-border bg-surface'].join(' ')}><Avatar name={rep.display_name} size="sm" /><span className="min-w-0 flex-1 truncate text-xs font-semibold text-fg">{rep.display_name}</span>{selected && <Check aria-hidden size={13} className="text-accent" />}</button> })}{roster.length === 0 && <p className="col-span-2 text-xs text-fg-subtle">No teammates found for this workspace yet.</p>}</div></fieldset>
      <fieldset className="mt-5"><legend className="label-caps">Due</legend><div className="mt-2 grid grid-cols-3 gap-1 rounded-md border border-border bg-surface-sunk p-1">{(['Today', 'Tomorrow', 'Pick'] as const).map((item) => <button type="button" key={item} onClick={() => setDue(item)} aria-pressed={due === item} className={['min-h-9 rounded-sm text-xs font-semibold', due === item ? 'bg-surface-raised text-fg shadow-elev-1' : 'text-fg-muted'].join(' ')}>{item}</button>)}</div>{due === 'Pick' && <input type="date" value={date} onChange={(event) => setDate(event.target.value)} aria-label="Todo due date" className="mt-2 h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-fg" />}</fieldset>
      <fieldset className="mt-5"><legend className="label-caps">Priority</legend><div className="mt-2 flex gap-2">{(['normal', 'high', 'urgent'] as const).map((item) => <button type="button" key={item} onClick={() => setPriority(item)} aria-pressed={priority === item} className={['min-h-9 flex-1 rounded-md border text-xs font-semibold capitalize', priority === item ? item === 'urgent' ? 'border-danger bg-danger-subtle text-danger' : item === 'high' ? 'border-warn bg-warn-subtle text-warn' : 'border-accent bg-accent-subtle text-accent' : 'border-border text-fg-muted'].join(' ')}>{item}</button>)}</div><p className="mt-2 text-2xs text-fg-subtle">Priority isn't stored yet — it shows for this session only.</p></fieldset>
      <Button size="lg" className="mt-6 w-full" onClick={create} disabled={!title.trim() || !assigneeIds.length}><Send aria-hidden size={15} /> Assign to {assigneeIds.length || 0}</Button>
      <p className="mt-2 text-center text-2xs text-fg-subtle">⌘ Enter to assign</p>
    </Sheet>
  )
}

function SetTargetForm({
  clientId,
  createdBy,
  roster,
}: {
  clientId: string
  createdBy: string
  roster: { user_id: string; display_name: string }[]
}) {
  const month = firstOfMonth()
  const { items: targets, loading, reload } = useTeamTargets(clientId, month)
  const [userId, setUserId] = useState(() => roster[0]?.user_id ?? '')
  const [targetValue, setTargetValue] = useState('')
  const [incentivePerWon, setIncentivePerWon] = useState('')
  const [bonusAtTarget, setBonusAtTarget] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!userId && roster[0]) setUserId(roster[0].user_id)
  }, [roster, userId])

  const existing = targets.find((t) => t.user_id === userId) ?? null
  useEffect(() => {
    setTargetValue(existing ? String(existing.target_value) : '')
    setIncentivePerWon(existing ? String(existing.incentive_per_won) : '')
    setBonusAtTarget(existing ? String(existing.bonus_at_target) : '')
  }, [existing?.id, userId])

  const save = async () => {
    if (!userId || !targetValue.trim()) return
    setSaving(true)
    setMessage(null)
    const res = await upsertTarget({
      clientId,
      userId,
      month,
      targetValue: Number(targetValue) || 0,
      incentivePerWon: Number(incentivePerWon) || 0,
      bonusAtTarget: Number(bonusAtTarget) || 0,
      createdBy,
    })
    setSaving(false)
    setMessage(res.ok ? 'Saved.' : res.message)
    if (res.ok) void reload()
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-4 shadow-elev-1">
      <div className="flex items-center gap-2"><Target aria-hidden size={15} className="text-accent" /><h3 className="text-sm font-semibold text-fg">Set this month's target</h3></div>
      <p className="mt-1 text-2xs text-fg-muted">Applies to {month.slice(0, 7)}. Saving replaces the rep's existing target for this month.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-4">
        <select value={userId} onChange={(event) => setUserId(event.target.value)} aria-label="Rep" className="h-10 rounded-md border border-border bg-surface-raised px-2 text-xs font-semibold text-fg sm:col-span-1">
          {roster.map((rep) => <option key={rep.user_id} value={rep.user_id}>{rep.display_name}</option>)}
        </select>
        <input value={targetValue} onChange={(event) => setTargetValue(event.target.value)} type="number" min="0" placeholder="Target value (₹)" aria-label="Target value" className="h-10 rounded-md border border-border bg-surface-raised px-2 text-xs text-fg placeholder:text-fg-subtle" />
        <input value={incentivePerWon} onChange={(event) => setIncentivePerWon(event.target.value)} type="number" min="0" placeholder="Incentive per won (₹)" aria-label="Incentive per won" className="h-10 rounded-md border border-border bg-surface-raised px-2 text-xs text-fg placeholder:text-fg-subtle" />
        <input value={bonusAtTarget} onChange={(event) => setBonusAtTarget(event.target.value)} type="number" min="0" placeholder="Bonus at target (₹)" aria-label="Bonus at target" className="h-10 rounded-md border border-border bg-surface-raised px-2 text-xs text-fg placeholder:text-fg-subtle" />
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Button onClick={save} disabled={saving || !userId || !targetValue.trim()}>{saving ? 'Saving…' : existing ? 'Update target' : 'Save target'}</Button>
        {message && <span className="text-2xs font-semibold text-fg-muted">{message}</span>}
      </div>
      {!loading && targets.length > 0 && (
        <div className="mt-4 overflow-x-auto border-t border-border pt-3">
          <table className="w-full min-w-[420px] text-left text-xs">
            <thead><tr className="text-2xs text-fg-subtle uppercase"><th className="pb-1.5 font-semibold">Rep</th><th className="pb-1.5 font-semibold">Target</th><th className="pb-1.5 font-semibold">Incentive/won</th><th className="pb-1.5 font-semibold">Bonus</th></tr></thead>
            <tbody>
              {targets.map((t) => (
                <tr key={t.id} className="border-t border-border">
                  <td className="py-1.5 font-semibold text-fg">{roster.find((r) => r.user_id === t.user_id)?.display_name ?? t.user_id.slice(0, 8)}</td>
                  <td className="tnum py-1.5 text-fg-muted">₹{t.target_value.toLocaleString('en-IN')}</td>
                  <td className="tnum py-1.5 text-fg-muted">₹{t.incentive_per_won.toLocaleString('en-IN')}</td>
                  <td className="tnum py-1.5 text-fg-muted">₹{t.bonus_at_target.toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export function TodosTab({ previewState = 'ready' }: { previewState?: 'ready' | 'loading' | 'empty' | 'error' }) {
  const { session } = useAuth()
  const { activeClient } = useClient()
  const clientId = activeClient?.id ?? null
  const userId = session?.user.id ?? null
  const manager = activeClient?.role === 'manager' || activeClient?.role === 'client_admin' || activeClient?.role === 'super_admin'

  const { items: todos, loading: todosLoading, error: todosError, reload } = useTodos(clientId)
  const { items: roster } = useProfiles(clientId)

  const [priorityById, setPriorityById] = useState<Record<string, TodoPriority>>({})
  const [composeOpen, setComposeOpen] = useState(false)
  const [quickTitle, setQuickTitle] = useState('')
  const [quickAssignee, setQuickAssignee] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedId, setSelectedId] = useState<string | null>(() => searchParams.get('t'))

  useEffect(() => {
    if (!quickAssignee && roster[0]) setQuickAssignee(roster[0].user_id)
  }, [roster, quickAssignee])

  const items = useMemo(() => todos.map((t) => toView(t, priorityById)), [todos, priorityById])

  const toggle = async (id: string) => {
    if (!clientId) return
    const current = todos.find((t) => t.id === id)
    if (!current) return
    const nextStatus: TodoStatus = current.status === 'done' ? 'pending' : 'done'
    const res = await toggleTodo(clientId, id, nextStatus)
    if (res.ok) void reload()
  }

  const openDetail = (id: string | null) => {
    setSelectedId(id)
    const next = new URLSearchParams(searchParams)
    if (id) next.set('t', id)
    else next.delete('t')
    setSearchParams(next, { replace: true })
  }

  const createQuick = async () => {
    if (!quickTitle.trim() || !quickAssignee || !clientId || !userId) return
    setBusy(true)
    setFormError(null)
    const res = await createTodo({
      clientId,
      title: quickTitle.trim(),
      assigneeIds: [quickAssignee],
      dueAt: `${localDateValue(0)}T17:00:00+05:30`,
      createdBy: userId,
    })
    setBusy(false)
    if (!res.ok) {
      setFormError(res.message)
      return
    }
    setPriorityById((prev) => {
      const next = { ...prev }
      for (const id of res.ids) next[id] = 'normal'
      return next
    })
    setQuickTitle('')
    void reload()
  }

  const createFull = async (input: { title: string; assigneeIds: string[]; dueAt: string; priority: TodoPriority }) => {
    if (!clientId || !userId) return
    const res = await createTodo({
      clientId,
      title: input.title,
      assigneeIds: input.assigneeIds,
      dueAt: input.dueAt,
      createdBy: userId,
    })
    if (!res.ok) {
      setFormError(res.message)
      return
    }
    setPriorityById((prev) => {
      const next = { ...prev }
      for (const id of res.ids) next[id] = input.priority
      return next
    })
    void reload()
  }

  const summaries = useMemo(
    () =>
      roster.map((rep) => {
        const assigned = todos.filter((t) => t.assignee === rep.user_id)
        return {
          id: rep.user_id,
          name: rep.display_name,
          open: assigned.filter((t) => t.status === 'pending').length,
          done: assigned.filter((t) => t.status === 'done').length,
          overdue: assigned.filter((t) => t.status === 'pending' && t.due_at && new Date(t.due_at).getTime() < Date.now()).length,
        }
      }),
    [roster, todos],
  )

  const selected = items.find((item) => item.id === selectedId) ?? null
  const myTodos = todos.filter((t) => t.assignee === userId)
  const myItems = items.filter((item) => myTodos.some((t) => t.id === item.id))
  const repOpen = myItems.filter((item) => item.status === 'open')
  const repDone = myItems.filter((item) => item.status === 'done')
  const repOverdue = repOpen.filter((item) => item.overdue).length

  if (previewState === 'loading' || todosLoading) return <div className="space-y-3 p-4"><Skeleton className="h-16" /><Skeleton className="h-32" /><Skeleton className="h-32" /></div>
  if (previewState === 'empty') return <EmptyState icon={ListTodo} title="No todos assigned." body={manager ? 'Create the first assignment from the quick bar.' : 'New manager assignments will land here and on Today.'} />
  if (previewState === 'error' || todosError) return <ErrorState title="Couldn't load todos" body={todosError ?? 'Check the connection and retry.'} onRetry={() => void reload()} />

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto bg-canvas">
        <div className="page-frame max-w-[1400px] space-y-5">
          <header className="flex flex-wrap items-end justify-between gap-3"><div><p className="label-caps text-accent">{manager ? 'Manager assignment desk' : 'Assigned to you'}</p><h2 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-fg">{manager ? 'Push the next action, not another message.' : 'Clear what your manager sent.'}</h2><p className="mt-1 text-xs text-fg-muted">{manager ? 'Create in one line, add context only when it matters.' : 'Done and snooze stay consistent with your Today stack.'}</p></div>{manager && <Button onClick={() => setComposeOpen(true)}><Plus aria-hidden size={15} /> Full assignment</Button>}</header>

          {formError && <p className="rounded-md border border-danger/30 bg-danger-subtle px-3 py-2 text-xs font-semibold text-danger">{formError}</p>}

          {manager && <section className="rounded-xl border border-border bg-surface p-3 shadow-elev-2"><div className="flex flex-col gap-2 sm:flex-row"><div className="relative min-w-0 flex-1"><ListTodo aria-hidden size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-fg-subtle" /><input value={quickTitle} onChange={(event) => setQuickTitle(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && void createQuick()} placeholder="Assign a todo…" aria-label="Quick todo title" className="h-11 w-full rounded-md border border-border bg-surface-raised pr-3 pl-9 text-sm text-fg placeholder:text-fg-subtle" /></div><select value={quickAssignee} onChange={(event) => setQuickAssignee(event.target.value)} aria-label="Quick todo assignee" className="h-11 rounded-md border border-border bg-surface px-3 text-sm text-fg">{roster.map((rep) => <option key={rep.user_id} value={rep.user_id}>{rep.display_name}</option>)}</select><button className="inline-flex h-11 items-center gap-2 rounded-md border border-border bg-surface px-3 text-xs font-semibold text-fg-muted hover:border-border-strong hover:text-fg" title="Due today"><CalendarDays aria-hidden size={14} /> Today</button><Button size="lg" onClick={() => void createQuick()} disabled={!quickTitle.trim() || !quickAssignee || busy}>Assign</Button></div><p className="mt-2 px-1 text-2xs text-fg-subtle">Enter to assign · Defaults to today, 5pm</p></section>}

          {manager && <section><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold text-fg">Team load</h3><span className="label-caps">Open / done / overdue</span></div><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{summaries.map((rep) => <article key={rep.id} className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3 shadow-elev-1"><Avatar name={rep.name} size="md" /><div className="min-w-0 flex-1"><h4 className="truncate text-xs font-semibold text-fg">{rep.name}</h4><p className="mt-1 text-2xs text-fg-muted"><strong className="tnum text-fg">{rep.open}</strong> open · {rep.done} done</p></div>{rep.overdue > 0 ? <span className="flex items-center gap-1 text-2xs font-semibold text-danger"><CircleAlert aria-hidden size={12} /> {rep.overdue}</span> : <Check aria-hidden size={15} className="text-success" />}</article>)}{roster.length === 0 && <p className="col-span-full rounded-lg border border-dashed border-border p-4 text-center text-xs text-fg-subtle">No teammates found for this workspace yet.</p>}</div></section>}

          {manager && clientId && userId && <SetTargetForm clientId={clientId} createdBy={userId} roster={roster} />}

          {manager ? <section><div className="mb-3 flex items-center gap-2"><Users aria-hidden size={15} className="text-accent" /><h3 className="text-sm font-semibold text-fg">Todos by rep</h3></div><div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">{roster.map((rep) => { const assigned = items.filter((item) => todos.find((t) => t.id === item.id)?.assignee === rep.user_id); return <section key={rep.user_id} className="min-w-0 rounded-xl border border-border bg-surface-sunk p-2"><header className="flex items-center gap-2 px-2 py-2"><Avatar name={rep.display_name} size="sm" /><div className="min-w-0 flex-1"><h4 className="truncate text-xs font-semibold text-fg">{rep.display_name}</h4><p className="text-2xs text-fg-subtle">{assigned.filter((item) => item.status === 'open').length} open</p></div></header><div className="space-y-2">{assigned.length ? assigned.map((item) => <AssignmentRow key={item.id} item={item} onToggle={() => void toggle(item.id)} onOpen={() => openDetail(item.id)} />) : <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-fg-subtle">Nothing assigned.</p>}</div></section> })}</div></section> : <section className="mx-auto max-w-4xl space-y-5"><div className="grid grid-cols-3 gap-2"><article className="rounded-lg border border-border bg-surface p-3 shadow-elev-1"><Target aria-hidden size={15} className="text-accent" /><p className="tnum mt-2 text-xl font-semibold text-fg">{repOpen.length}</p><p className="text-2xs font-semibold text-fg-muted">Open</p></article><article className="rounded-lg border border-border bg-surface p-3 shadow-elev-1"><CircleAlert aria-hidden size={15} className={repOverdue ? 'text-danger' : 'text-fg-subtle'} /><p className="tnum mt-2 text-xl font-semibold text-fg">{repOverdue}</p><p className="text-2xs font-semibold text-fg-muted">Overdue</p></article><article className="rounded-lg border border-border bg-surface p-3 shadow-elev-1"><Check aria-hidden size={15} className="text-success" /><p className="tnum mt-2 text-xl font-semibold text-fg">{repDone.length}</p><p className="text-2xs font-semibold text-fg-muted">Done</p></article></div><section><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold text-fg">Needs attention</h3><span className="text-2xs text-fg-muted">{repOpen.length} open</span></div>{repOpen.length ? <div className="grid gap-3 lg:grid-cols-2">{repOpen.map((item) => <AssignmentRow key={item.id} item={item} onToggle={() => void toggle(item.id)} onOpen={() => openDetail(item.id)} />)}</div> : <EmptyState icon={ListTodo} title="Nothing open." body="New manager assignments will land here." />}</section>{repDone.length > 0 && <section><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold text-fg">Completed</h3><span className="text-2xs text-fg-muted">Tap to review or reopen</span></div><div className="grid gap-3 lg:grid-cols-2">{repDone.map((item) => <AssignmentRow key={item.id} item={item} onToggle={() => void toggle(item.id)} onOpen={() => openDetail(item.id)} />)}</div></section>}</section>}
        </div>
      </div>
      <ComposeSheet open={composeOpen} onClose={() => setComposeOpen(false)} roster={roster} onCreate={(input) => void createFull(input)} />
      <Sheet open={!!selected} onClose={() => openDetail(null)} title="Task details">{selected && <TodoDetail item={selected} onToggle={() => void toggle(selected.id)} />}</Sheet>
    </div>
  )
}
