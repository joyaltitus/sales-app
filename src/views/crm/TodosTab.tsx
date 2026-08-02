import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  CalendarDays,
  Check,
  ChevronRight,
  CircleAlert,
  Clock3,
  Link2,
  ListTodo,
  Plus,
  RotateCcw,
  Send,
  Target,
  Users,
} from 'lucide-react'
import { useClient } from '../../shell/ClientProvider'
import { Avatar } from '../../ui/Avatar'
import { Button } from '../../ui/Button'
import { Chip } from '../../ui/Chip'
import { EmptyState } from '../../ui/EmptyState'
import { ErrorState } from '../../ui/ErrorState'
import { Sheet } from '../../ui/Sheet'
import { Skeleton } from '../../ui/Skeleton'
import { SampleBanner } from './CrmScreen'
import { TODO_PREVIEW_ITEMS, TODO_REPS } from './todoMocks'
import type { TodoAssignmentPreview, TodoPriorityPreview } from './todoMocks'
import { NextAction } from '../../ui/NextAction'

const PRIORITY_TONE: Record<TodoPriorityPreview, 'neutral' | 'warn' | 'danger'> = {
  normal: 'neutral',
  high: 'warn',
  urgent: 'danger',
}

function localDateValue(dayOffset: number) {
  const date = new Date()
  date.setDate(date.getDate() + dayOffset)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function AssignmentRow({ item, onToggle, onOpen }: { item: TodoAssignmentPreview; onToggle: () => void; onOpen: () => void }) {
  return (
    <article className={['rounded-lg border bg-surface p-3 shadow-elev-1', item.overdue && item.status === 'open' ? 'border-[color-mix(in_srgb,var(--danger)_30%,var(--border))]' : 'border-border'].join(' ')}>
      <div className="flex items-start gap-3">
        <button onClick={onToggle} aria-label={`Mark ${item.title} ${item.status === 'done' ? 'open' : 'done'} (preview)`} aria-pressed={item.status === 'done'} className={['mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-colors', item.status === 'done' ? 'border-success bg-success text-white' : 'border-border-strong text-transparent hover:border-success hover:bg-success-subtle hover:text-success'].join(' ')}><Check aria-hidden size={13} strokeWidth={2.4} /></button>
        <div className="min-w-0 flex-1"><h4 className={['text-xs font-semibold leading-relaxed', item.status === 'done' ? 'text-fg-subtle line-through' : 'text-fg'].join(' ')}>{item.title}</h4><div className="mt-2 flex flex-wrap items-center gap-1.5"><Chip tone={PRIORITY_TONE[item.priority]}>{item.priority}</Chip><span className={['text-2xs font-semibold', item.overdue && item.status === 'open' ? 'text-danger' : 'text-fg-muted'].join(' ')}>{item.overdue && item.status === 'open' ? 'Overdue · ' : ''}{item.dueLabel}</span></div></div>
      </div>
      {item.link && <button onClick={onOpen} className="mt-3 flex min-h-9 w-full items-center gap-2 rounded-md border border-border bg-surface-sunk px-3 text-left text-xs font-semibold text-fg-muted hover:border-border-strong hover:text-fg"><Link2 aria-hidden size={13} /><span className="min-w-0 flex-1 truncate">{item.link.kind === 'lead' ? 'Lead' : 'Conversation'} · {item.link.label}</span><ChevronRight aria-hidden size={13} /></button>}
      <div className="mt-2"><NextAction compact label={item.status === 'done' ? 'No action — completed' : item.overdue ? 'Complete or reassign now' : `Complete by ${item.dueLabel}`} /></div>
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-2.5"><span className="flex -space-x-1.5">{item.assignees.map((name) => <span key={name} className="rounded-[11px] border-2 border-surface"><Avatar name={name} size="sm" /></span>)}</span><button onClick={onOpen} className="inline-flex min-h-8 items-center gap-1 rounded-md px-2 text-2xs font-semibold text-accent hover:bg-accent-subtle">View details <ChevronRight aria-hidden size={12} /></button></div>
    </article>
  )
}

function TodoDetail({ item, onToggle }: { item: TodoAssignmentPreview; onToggle: () => void }) {
  return (
    <div className="space-y-5" data-testid="todo-details">
      <div>
        <div className="flex flex-wrap items-center gap-2"><Chip tone={PRIORITY_TONE[item.priority]}>{item.priority} priority</Chip><Chip tone={item.status === 'done' ? 'success' : item.overdue ? 'danger' : 'accent'}>{item.status === 'done' ? 'Completed' : item.overdue ? 'Overdue' : 'Open'}</Chip><span className="text-2xs font-semibold text-fg-subtle">Preview · local only</span></div>
        <h3 className="mt-3 text-xl font-semibold leading-snug tracking-[-0.03em] text-fg">{item.title}</h3>
        <p className={['mt-2 flex items-center gap-1.5 text-xs font-semibold', item.overdue && item.status === 'open' ? 'text-danger' : 'text-fg-muted'].join(' ')}><Clock3 aria-hidden size={14} /> {item.dueLabel}</p>
      </div>

      <section className="rounded-lg border border-border bg-surface-sunk p-3">
        <p className="label-caps">Assigned to</p>
        <div className="mt-3 space-y-2">{item.assignees.map((name) => <div key={name} className="flex items-center gap-2"><Avatar name={name} size="sm" /><span className="text-xs font-semibold text-fg">{name}</span></div>)}</div>
        <p className="mt-3 border-t border-border pt-3 text-2xs text-fg-muted">Created by <strong className="text-fg">{item.createdBy}</strong></p>
      </section>

      {item.link && <section className="rounded-lg border border-border bg-surface p-3"><p className="label-caps">Linked context</p><div className="mt-2 flex items-center gap-2 text-xs font-semibold text-fg"><Link2 aria-hidden size={14} className="text-accent" /> {item.link.kind === 'lead' ? 'Lead' : 'Conversation'} · {item.link.label}</div><p className="mt-2 text-2xs leading-relaxed text-fg-muted">The record link is sample data. Live navigation will be enabled when manager todos are wired.</p></section>}

      <section>
        <p className="label-caps text-accent">Next action</p>
        <div className="mt-2"><NextAction label={item.status === 'done' ? 'No action — this task is complete' : item.overdue ? 'Complete this now or ask the manager to reassign it' : `Complete this task by ${item.dueLabel}`} /></div>
      </section>

      <section>
        <p className="label-caps">Task activity</p>
        <ol className="mt-3 space-y-3 border-l border-border pl-4">
          <li><p className="text-xs font-semibold text-fg">Assigned by {item.createdBy}</p><p className="mt-0.5 text-2xs text-fg-muted">Shared with {item.assignees.join(', ')}</p></li>
          <li><p className="text-xs font-semibold text-fg">Due {item.dueLabel}</p><p className="mt-0.5 text-2xs text-fg-muted">Priority set to {item.priority}</p></li>
          {item.status === 'done' && <li><p className="text-xs font-semibold text-success">Marked complete</p><p className="mt-0.5 text-2xs text-fg-muted">Preview update on this device</p></li>}
        </ol>
      </section>

      <Button size="lg" className="w-full" onClick={onToggle}>{item.status === 'done' ? <RotateCcw aria-hidden size={15} /> : <Check aria-hidden size={15} />}{item.status === 'done' ? 'Reopen task' : 'Mark task done'}</Button>
    </div>
  )
}

function ComposeSheet({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (item: TodoAssignmentPreview) => void }) {
  const [title, setTitle] = useState('')
  const [assignees, setAssignees] = useState<string[]>(['Asha Thomas'])
  const [due, setDue] = useState<'Today' | 'Tomorrow' | 'Pick'>('Today')
  const [date, setDate] = useState(() => localDateValue(2))
  const [priority, setPriority] = useState<TodoPriorityPreview>('normal')
  const [link, setLink] = useState('')

  const create = () => {
    if (!title.trim() || !assignees.length) return
    const dueDate = due === 'Today' ? localDateValue(0) : due === 'Tomorrow' ? localDateValue(1) : date
    onCreate({ id: `todo-local-${Date.now()}`, title: title.trim(), assignees, dueLabel: due === 'Pick' ? `${date} · 5:00 pm` : `${due} · 5:00 pm`, dueAt: `${dueDate}T17:00:00+05:30`, overdue: false, priority, status: 'open', createdBy: 'You', link: link ? { kind: link.startsWith('conv') ? 'conversation' : 'lead', id: link, label: link === 'lead-anjali' ? 'Anjali Ramesh' : 'Rahul Das' } : undefined, sample: true })
    setTitle('')
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title="Assign a todo">
      <label className="block"><span className="label-caps">Title</span><input value={title} onChange={(event) => setTitle(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) create() }} autoFocus placeholder="What needs to happen?" className="mt-2 h-11 w-full rounded-md border border-border bg-surface-raised px-3 text-sm text-fg placeholder:text-fg-subtle" /></label>
      <fieldset className="mt-5"><legend className="label-caps">Assign to</legend><div className="mt-2 grid grid-cols-2 gap-2">{TODO_REPS.map((rep) => { const selected = assignees.includes(rep.name); return <button type="button" key={rep.id} onClick={() => setAssignees((all) => selected ? all.filter((name) => name !== rep.name) : [...all, rep.name])} aria-pressed={selected} className={['flex min-h-12 items-center gap-2 rounded-md border px-2.5 text-left', selected ? 'border-accent bg-accent-subtle' : 'border-border bg-surface'].join(' ')}><Avatar name={rep.name} size="sm" /><span className="min-w-0 flex-1 truncate text-xs font-semibold text-fg">{rep.name}</span>{selected && <Check aria-hidden size={13} className="text-accent" />}</button> })}</div></fieldset>
      <fieldset className="mt-5"><legend className="label-caps">Due</legend><div className="mt-2 grid grid-cols-3 gap-1 rounded-md border border-border bg-surface-sunk p-1">{(['Today', 'Tomorrow', 'Pick'] as const).map((item) => <button type="button" key={item} onClick={() => setDue(item)} aria-pressed={due === item} className={['min-h-9 rounded-sm text-xs font-semibold', due === item ? 'bg-surface-raised text-fg shadow-elev-1' : 'text-fg-muted'].join(' ')}>{item}</button>)}</div>{due === 'Pick' && <input type="date" value={date} onChange={(event) => setDate(event.target.value)} aria-label="Todo due date" className="mt-2 h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-fg" />}</fieldset>
      <fieldset className="mt-5"><legend className="label-caps">Priority</legend><div className="mt-2 flex gap-2">{(['normal', 'high', 'urgent'] as const).map((item) => <button type="button" key={item} onClick={() => setPriority(item)} aria-pressed={priority === item} className={['min-h-9 flex-1 rounded-md border text-xs font-semibold capitalize', priority === item ? item === 'urgent' ? 'border-danger bg-danger-subtle text-danger' : item === 'high' ? 'border-warn bg-warn-subtle text-warn' : 'border-accent bg-accent-subtle text-accent' : 'border-border text-fg-muted'].join(' ')}>{item}</button>)}</div></fieldset>
      <label className="mt-5 block"><span className="label-caps">Link (optional)</span><select value={link} onChange={(event) => setLink(event.target.value)} className="mt-2 h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-fg"><option value="">No linked record</option><option value="lead-anjali">Lead · Anjali Ramesh</option><option value="conv-rahul">Conversation · Rahul Das</option></select></label>
      <Button size="lg" className="mt-6 w-full" onClick={create} disabled={!title.trim() || !assignees.length}><Send aria-hidden size={15} /> Assign to {assignees.length || 0}</Button>
      <p className="mt-2 text-center text-2xs text-fg-subtle">⌘ Enter to assign · Preview — not wired</p>
    </Sheet>
  )
}

export function TodosTab({ previewState = 'ready' }: { previewState?: 'ready' | 'loading' | 'empty' | 'error' }) {
  const { activeClient } = useClient()
  const manager = activeClient?.role === 'manager' || activeClient?.role === 'client_admin' || activeClient?.role === 'super_admin'
  const [items, setItems] = useState(TODO_PREVIEW_ITEMS)
  const [composeOpen, setComposeOpen] = useState(false)
  const [quickTitle, setQuickTitle] = useState('')
  const [quickAssignee, setQuickAssignee] = useState(TODO_REPS[0].name)
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedId, setSelectedId] = useState<string | null>(() => searchParams.get('t'))

  const toggle = (id: string) => setItems((all) => all.map((item) => item.id === id ? { ...item, status: item.status === 'done' ? 'open' : 'done' } : item))
  const openDetail = (id: string | null) => {
    setSelectedId(id)
    const next = new URLSearchParams(searchParams)
    if (id) next.set('t', id)
    else next.delete('t')
    setSearchParams(next, { replace: true })
  }
  const createQuick = () => {
    if (!quickTitle.trim()) return
    setItems((all) => [{ id: `todo-quick-${Date.now()}`, title: quickTitle.trim(), assignees: [quickAssignee], dueLabel: 'Today · 5:00 pm', dueAt: `${localDateValue(0)}T17:00:00`, overdue: false, priority: 'normal', status: 'open', createdBy: 'You', sample: true }, ...all])
    setQuickTitle('')
  }

  const summaries = useMemo(() => TODO_REPS.map((rep) => { const assigned = items.filter((item) => item.assignees.includes(rep.name)); return { ...rep, open: assigned.filter((item) => item.status === 'open').length, done: assigned.filter((item) => item.status === 'done').length, overdue: assigned.filter((item) => item.status === 'open' && item.overdue).length } }), [items])
  const selected = items.find((item) => item.id === selectedId) ?? null
  const repItems = items.filter((item) => item.assignees.includes('Asha Thomas'))
  const repOpen = repItems.filter((item) => item.status === 'open')
  const repDone = repItems.filter((item) => item.status === 'done')
  const repOverdue = repOpen.filter((item) => item.overdue).length

  if (previewState === 'loading') return <div className="space-y-3 p-4"><Skeleton className="h-16" /><Skeleton className="h-32" /><Skeleton className="h-32" /></div>
  if (previewState === 'empty') return <EmptyState icon={ListTodo} title="No todos assigned." body={manager ? 'Create the first assignment from the quick bar.' : 'New manager assignments will land here and on Today.'} />
  if (previewState === 'error') return <ErrorState title="Couldn’t load todos" body="Check the connection and retry." onRetry={() => undefined} />

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SampleBanner>Preview — manager assignments and todo updates are not wired</SampleBanner>
      <div className="min-h-0 flex-1 overflow-y-auto bg-canvas">
        <div className="page-frame max-w-[1400px] space-y-5">
          <header className="flex flex-wrap items-end justify-between gap-3"><div><p className="label-caps text-accent">{manager ? 'Manager assignment desk' : 'Assigned to you'}</p><h2 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-fg">{manager ? 'Push the next action, not another message.' : 'Clear what your manager sent.'}</h2><p className="mt-1 text-xs text-fg-muted">{manager ? 'Create in one line, add context only when it matters.' : 'Done and snooze stay consistent with your Today stack.'}</p></div>{manager && <Button onClick={() => setComposeOpen(true)}><Plus aria-hidden size={15} /> Full assignment</Button>}</header>

          {manager && <section className="rounded-xl border border-border bg-surface p-3 shadow-elev-2"><div className="flex flex-col gap-2 sm:flex-row"><div className="relative min-w-0 flex-1"><ListTodo aria-hidden size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-fg-subtle" /><input value={quickTitle} onChange={(event) => setQuickTitle(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && createQuick()} placeholder="Assign a todo…" aria-label="Quick todo title" className="h-11 w-full rounded-md border border-border bg-surface-raised pr-3 pl-9 text-sm text-fg placeholder:text-fg-subtle" /></div><select value={quickAssignee} onChange={(event) => setQuickAssignee(event.target.value)} aria-label="Quick todo assignee" className="h-11 rounded-md border border-border bg-surface px-3 text-sm text-fg">{TODO_REPS.map((rep) => <option key={rep.id}>{rep.name}</option>)}</select><button className="inline-flex h-11 items-center gap-2 rounded-md border border-border bg-surface px-3 text-xs font-semibold text-fg-muted hover:border-border-strong hover:text-fg" title="Due today"><CalendarDays aria-hidden size={14} /> Today</button><Button size="lg" onClick={createQuick} disabled={!quickTitle.trim()}>Assign</Button></div><p className="mt-2 px-1 text-2xs text-fg-subtle">Enter to assign · Defaults to today and normal priority</p></section>}

          {manager && <section><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold text-fg">Team load</h3><span className="label-caps">Open / done / overdue</span></div><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{summaries.map((rep) => <article key={rep.id} className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3 shadow-elev-1"><Avatar name={rep.name} size="md" /><div className="min-w-0 flex-1"><h4 className="truncate text-xs font-semibold text-fg">{rep.name}</h4><p className="mt-1 text-2xs text-fg-muted"><strong className="tnum text-fg">{rep.open}</strong> open · {rep.done} done</p></div>{rep.overdue > 0 ? <span className="flex items-center gap-1 text-2xs font-semibold text-danger"><CircleAlert aria-hidden size={12} /> {rep.overdue}</span> : <Check aria-hidden size={15} className="text-success" />}</article>)}</div></section>}

          {manager ? <section><div className="mb-3 flex items-center gap-2"><Users aria-hidden size={15} className="text-accent" /><h3 className="text-sm font-semibold text-fg">Todos by rep</h3></div><div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">{TODO_REPS.map((rep) => { const assigned = items.filter((item) => item.assignees.includes(rep.name)); return <section key={rep.id} className="min-w-0 rounded-xl border border-border bg-surface-sunk p-2"><header className="flex items-center gap-2 px-2 py-2"><Avatar name={rep.name} size="sm" /><div className="min-w-0 flex-1"><h4 className="truncate text-xs font-semibold text-fg">{rep.name}</h4><p className="text-2xs text-fg-subtle">{assigned.filter((item) => item.status === 'open').length} open</p></div></header><div className="space-y-2">{assigned.length ? assigned.map((item) => <AssignmentRow key={item.id} item={item} onToggle={() => toggle(item.id)} onOpen={() => openDetail(item.id)} />) : <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-fg-subtle">Nothing assigned.</p>}</div></section> })}</div></section> : <section className="mx-auto max-w-4xl space-y-5"><div className="grid grid-cols-3 gap-2"><article className="rounded-lg border border-border bg-surface p-3 shadow-elev-1"><Target aria-hidden size={15} className="text-accent" /><p className="tnum mt-2 text-xl font-semibold text-fg">{repOpen.length}</p><p className="text-2xs font-semibold text-fg-muted">Open</p></article><article className="rounded-lg border border-border bg-surface p-3 shadow-elev-1"><CircleAlert aria-hidden size={15} className={repOverdue ? 'text-danger' : 'text-fg-subtle'} /><p className="tnum mt-2 text-xl font-semibold text-fg">{repOverdue}</p><p className="text-2xs font-semibold text-fg-muted">Overdue</p></article><article className="rounded-lg border border-border bg-surface p-3 shadow-elev-1"><Check aria-hidden size={15} className="text-success" /><p className="tnum mt-2 text-xl font-semibold text-fg">{repDone.length}</p><p className="text-2xs font-semibold text-fg-muted">Done</p></article></div><section><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold text-fg">Needs attention</h3><span className="text-2xs text-fg-muted">{repOpen.length} open</span></div><div className="grid gap-3 lg:grid-cols-2">{repOpen.map((item) => <AssignmentRow key={item.id} item={item} onToggle={() => toggle(item.id)} onOpen={() => openDetail(item.id)} />)}</div></section>{repDone.length > 0 && <section><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold text-fg">Completed</h3><span className="text-2xs text-fg-muted">Tap to review or reopen</span></div><div className="grid gap-3 lg:grid-cols-2">{repDone.map((item) => <AssignmentRow key={item.id} item={item} onToggle={() => toggle(item.id)} onOpen={() => openDetail(item.id)} />)}</div></section>}</section>}
        </div>
      </div>
      <ComposeSheet open={composeOpen} onClose={() => setComposeOpen(false)} onCreate={(item) => setItems((all) => [item, ...all])} />
      <Sheet open={!!selected} onClose={() => openDetail(null)} title="Task details">{selected && <TodoDetail item={selected} onToggle={() => toggle(selected.id)} />}</Sheet>
    </div>
  )
}
