import { useState } from 'react'
import { DashboardScreen } from '../dashboard/DashboardScreen'
import { ContactsTab } from '../crm/ContactsTab'
import { BookingsTab } from '../crm/BookingsTab'
import { TodosTab } from '../crm/TodosTab'
import { useTheme } from '../../shell/theme'

// SA-04 design-review surface — the same convention as /kitchen-sink and
// /samples (public design routes for review + screenshots without a session).
// It can only mount the SAMPLE-DATA surfaces (Dashboard, CRM's mock tabs):
// they read lib/mock-data.ts and never touch Supabase, so there is nothing
// here a session would gate. The REAL screens (Inbox, Pipeline, landings)
// still require a login and are absent by design — this route must never grow
// a provider stub that fakes an authed tenant.
const VIEWS = ['dashboard', 'contacts', 'bookings', 'todos'] as const
type View = (typeof VIEWS)[number]

export function DesignPreview() {
  const [view, setView] = useState<View>('dashboard')
  const { theme, toggle } = useTheme()

  return (
    <div className="flex h-full flex-col bg-canvas">
      <div className="flex shrink-0 items-center gap-1 border-b border-border bg-surface px-2 py-1.5">
        {VIEWS.map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            aria-pressed={view === v}
            className={[
              'rounded-sm px-2.5 py-1 text-xs font-medium capitalize transition-colors',
              view === v ? 'bg-accent-subtle text-accent' : 'text-fg-muted hover:text-fg',
            ].join(' ')}
          >
            {v}
          </button>
        ))}
        <button
          onClick={toggle}
          className="ml-auto rounded-sm px-2.5 py-1 text-xs font-medium text-fg-muted hover:text-fg"
        >
          {theme === 'dark' ? 'Light' : 'Dark'}
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {view === 'dashboard' && <DashboardScreen />}
        {view === 'contacts' && <ContactsTab />}
        {view === 'bookings' && <BookingsTab />}
        {view === 'todos' && <TodosTab />}
      </div>
    </div>
  )
}
