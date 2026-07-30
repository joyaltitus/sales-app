import { lazy, Suspense } from 'react'
import { NavLink, Route, Routes, Navigate } from 'react-router-dom'
import { Activity, Inbox, Users, LayoutDashboard } from 'lucide-react'
import { TopBar } from './TopBar'
import { Skeleton } from '../ui/Skeleton'
import { Health, AdminInbox } from '../views/admin/screens'

// SA-04: same lazy split as ManagerShell — CRM/Dashboard weight stays off the
// first load and off the rep bundle entirely.
const CrmScreen = lazy(() =>
  import('../views/crm/CrmScreen').then((m) => ({ default: m.CrmScreen })),
)
const DashboardScreen = lazy(() =>
  import('../views/dashboard/DashboardScreen').then((m) => ({ default: m.DashboardScreen })),
)

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
//
// SA-04 rail change (ruling 2026-07-30, §S6): `Leads` folded into CRM as its
// Pipeline tab; Dashboard added. Old /leads deep links redirect.
const RAIL = [
  { to: '/', label: 'Health', icon: Activity, end: true },
  { to: '/inbox', label: 'Inbox', icon: Inbox },
  { to: '/crm', label: 'CRM', icon: Users },
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
]

function LazyFallback() {
  return (
    <div className="space-y-2 p-4">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  )
}

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
                  'mb-0.5 flex items-center gap-2.5 rounded-sm px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-accent-subtle text-accent'
                    : 'text-fg-muted hover:bg-surface-sunk hover:text-fg',
                ].join(' ')
              }
            >
              <t.icon aria-hidden size={16} strokeWidth={1.75} />
              {t.label}
            </NavLink>
          ))}
        </nav>
        <main className="min-w-0 flex-1 overflow-y-auto">
          <Suspense fallback={<LazyFallback />}>
            <Routes>
              <Route index element={<Health />} />
              <Route path="inbox" element={<AdminInbox />} />
              <Route path="crm" element={<CrmScreen />} />
              <Route path="dashboard" element={<DashboardScreen />} />
              <Route path="leads" element={<Navigate to="/crm" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </div>
  )
}
