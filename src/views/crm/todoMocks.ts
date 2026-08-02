export type TodoPriorityPreview = 'normal' | 'high' | 'urgent'

export type TodoAssignmentPreview = {
  id: string
  title: string
  assignees: string[]
  dueLabel: string
  dueAt: string
  overdue: boolean
  priority: TodoPriorityPreview
  status: 'open' | 'done'
  createdBy: string
  link?: { kind: 'lead' | 'conversation'; id: string; label: string }
  sample: true
}

export type TodoRepPreview = {
  id: string
  name: string
  role: string
  sample: true
}

const dueAt = (dayOffset: number, hour: number, minute = 0) => {
  const date = new Date()
  date.setDate(date.getDate() + dayOffset)
  date.setHours(hour, minute, 0, 0)
  return date.toISOString()
}

export const TODO_REPS: TodoRepPreview[] = [
  { id: 'rep-asha', name: 'Asha Thomas', role: 'Admissions', sample: true },
  { id: 'rep-nikhil', name: 'Nikhil S.', role: 'Admissions', sample: true },
  { id: 'rep-arun', name: 'Arun P.', role: 'Counselling', sample: true },
  { id: 'rep-diya', name: 'Diya Jose', role: 'Admissions', sample: true },
]

export const TODO_PREVIEW_ITEMS: TodoAssignmentPreview[] = [
  { id: 'todo-p1', title: 'Call Anjali before the fee deadline', assignees: ['Asha Thomas'], dueLabel: 'Today · 4:30 pm', dueAt: dueAt(0, 16, 30), overdue: false, priority: 'urgent', status: 'open', createdBy: 'Meera Nair', link: { kind: 'lead', id: 'lead-anjali', label: 'Anjali Ramesh' }, sample: true },
  { id: 'todo-p2', title: 'Send the parent reference to Rahul', assignees: ['Asha Thomas'], dueLabel: 'Overdue · 1 hour', dueAt: dueAt(0, Math.max(0, new Date().getHours() - 1)), overdue: true, priority: 'high', status: 'open', createdBy: 'Meera Nair', link: { kind: 'conversation', id: 'conv-rahul', label: 'Rahul Das' }, sample: true },
  { id: 'todo-p3', title: 'Confirm tomorrow’s campus visit slots', assignees: ['Nikhil S.'], dueLabel: 'Tomorrow · 10:00 am', dueAt: dueAt(1, 10), overdue: false, priority: 'normal', status: 'open', createdBy: 'Meera Nair', sample: true },
  { id: 'todo-p4', title: 'Review the Trust v2 call notes', assignees: ['Arun P.', 'Diya Jose'], dueLabel: 'Today · 5:00 pm', dueAt: dueAt(0, 17), overdue: false, priority: 'high', status: 'open', createdBy: 'Meera Nair', link: { kind: 'lead', id: 'lead-fathima', label: 'Fathima P.' }, sample: true },
  { id: 'todo-p5', title: 'Update the competitor comparison', assignees: ['Nikhil S.'], dueLabel: 'Done yesterday', dueAt: dueAt(-1, 12), overdue: false, priority: 'normal', status: 'done', createdBy: 'Meera Nair', sample: true },
]
