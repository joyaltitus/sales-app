import { useSearchParams } from 'react-router-dom'
import { Kanban, Contact, CalendarCheck, AlarmClock, ListTodo } from 'lucide-react'
import { LeadsScreen } from '../leads/LeadsScreen'
import { ContactsTab } from './ContactsTab'
import { BookingsTab } from './BookingsTab'
import { FollowUpsTab } from './FollowUpsTab'
import { TodosTab } from './TodosTab'

// SA-05 CRM — one rail door, five tabs. Mounted by ALL THREE shells now
// (Joyal's ruling 2026-07-30 supersedes SA-04's rep exclusion): reps see
// their own + unassigned leads (scoped in LeadsScreen, rendering-only).
//
// REAL vs SAMPLE:
//   Pipeline   → REAL (board + drawer, RLS-gated writes; only the row-level
//                assignment/objection selects remain SAMPLE)
//   Follow-ups → REAL reads; actions still deferred
//   Contacts   → REAL (SA-05)
//   Bookings   → REAL (SA-05)
//   Todos      → SAMPLE (employee_todos is not a table yet — Wave 1)
//
// The tab is URL-backed (`?tab=`) so a filtered view survives refresh, same
// convention as the Inbox channel tabs.
type CrmTab = 'pipeline' | 'contacts' | 'bookings' | 'followups' | 'todos'

const TABS: { key: CrmTab; label: string; icon: typeof Kanban }[] = [
  { key: 'pipeline', label: 'Pipeline', icon: Kanban },
  { key: 'followups', label: 'Follow-ups', icon: AlarmClock },
  { key: 'contacts', label: 'Contacts', icon: Contact },
  { key: 'bookings', label: 'Bookings', icon: CalendarCheck },
  { key: 'todos', label: 'Todos', icon: ListTodo },
]

const VALID = new Set<string>(TABS.map((t) => t.key))

export function CrmScreen() {
  const [searchParams, setSearchParams] = useSearchParams()
  const raw = searchParams.get('tab')
  const tab: CrmTab = raw && VALID.has(raw) ? (raw as CrmTab) : 'pipeline'
  const setTab = (next: CrmTab) => {
    const params = new URLSearchParams(searchParams)
    if (next === 'pipeline') params.delete('tab')
    else params.set('tab', next)
    setSearchParams(params, { replace: true })
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-end justify-between gap-3 border-b border-border bg-surface px-4 pt-4 pb-3">
        <div>
          <p className="label-caps text-accent">Revenue workspace</p>
          <h1 className="mt-1 text-lg font-semibold tracking-[-0.025em] text-fg">CRM</h1>
        </div>
        <p className="hidden text-xs text-fg-muted sm:block">Move the work forward, not the rows around.</p>
      </div>
      <div
        role="tablist"
        aria-label="CRM sections"
        className="flex shrink-0 gap-1 overflow-x-auto border-b border-border bg-surface px-3 pt-1.5"
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={[
              'flex min-h-10 shrink-0 items-center gap-1.5 border-b-2 px-3 pt-1 pb-1.5 text-sm font-semibold transition-colors',
              tab === t.key
                ? 'border-accent text-fg'
                : 'border-transparent text-fg-muted hover:text-fg',
            ].join(' ')}
          >
            <t.icon aria-hidden size={15} strokeWidth={1.75} />
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        {tab === 'pipeline' && <LeadsScreen crm />}
        {tab === 'followups' && <FollowUpsTab />}
        {tab === 'contacts' && <ContactsTab />}
        {tab === 'bookings' && <BookingsTab />}
        {tab === 'todos' && <TodosTab />}
      </div>
    </div>
  )
}

/** Shared "this surface is sample data" banner — the visual contract that a
 *  tab is awaiting its wiring session. Deliberately quiet: a caption, not a
 *  toast (§1.10 #14 still binds). */
export function SampleBanner({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="border-b border-border bg-surface-sunk px-4 py-1.5 text-2xs text-fg-subtle uppercase"
      style={{ fontWeight: 'var(--weight-caps)', letterSpacing: 'var(--tracking-caps)' }}
    >
      {children}
    </p>
  )
}
