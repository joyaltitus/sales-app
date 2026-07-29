import { NavLink, Route, Routes, Navigate } from 'react-router-dom'
import { TopBar } from './TopBar'
import { Health, AdminInbox, AdminLeads } from '../views/admin/screens'

// Admin view: desktop-first, left rail — deliberately the SAME pattern as
// ManagerShell rather than a new one. §S5: "an extension of a working pattern,
// not new architecture."
//
// This shell exists because of Joyal's 2026-07-29 ruling: THREE shells, not
// four. `client_admin` gets this; `super_admin` KEEPS the HandoffScreen punt to
// Workbench. RoleRouter's test suite guards both halves of that ruling.
//
// Ordering amendment (direction doc §3.1), recorded here because it is easy to
// lose: app-01-consolidation-spec.md calls AdminShell "Stage 1" and pairs it
// with the ONB-CON-01F console merge. This line of work is not the ONB path, so
// AdminShell arrives as the spec's "Stage 2..N — port by need", with real
// screens rather than as a fourth blank shell. Two items remain OWED elsewhere
// and are NOT closed by this file: the ONB-CON-01F console merge, and the
// Stage-0 USE/DEAD triage of all 19 Workbench pages (which still gates
// Workbench retirement and P7 checklist #4's archive flag).
const RAIL = [
  { to: '/', label: 'Health', end: true },
  { to: '/inbox', label: 'Inbox' },
  { to: '/leads', label: 'Leads' },
]

export function AdminShell() {
  return (
    <div className="flex h-full flex-col bg-canvas">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <nav className="w-48 shrink-0 border-r border-border bg-surface p-2" aria-label="Primary">
          {RAIL.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                [
                  'mb-0.5 block rounded-sm px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-accent-subtle text-accent'
                    : 'text-fg-muted hover:bg-surface-sunk hover:text-fg',
                ].join(' ')
              }
            >
              {t.label}
            </NavLink>
          ))}
        </nav>
        <main className="min-w-0 flex-1 overflow-y-auto">
          <Routes>
            <Route index element={<Health />} />
            <Route path="inbox" element={<AdminInbox />} />
            <Route path="leads" element={<AdminLeads />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
