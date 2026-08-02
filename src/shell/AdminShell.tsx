import { lazy, Suspense } from 'react'
import { NavLink, Route, Routes, Navigate } from 'react-router-dom'
import { Activity, Inbox, Users, LayoutDashboard, FileText } from 'lucide-react'
import { TopBar } from './TopBar'
import { Skeleton } from '../ui/Skeleton'
import { Health, AdminInbox } from '../views/admin/screens'

// SA-04: same lazy split as ManagerShell — CRM/Dashboard weight stays off the
// first load and off the rep bundle entirely.
const CrmScreen = lazy(() =>
  import('../views/crm/CrmScreen').then((m) => ({ default: m.CrmScreen })),
)
const DocsStudio = lazy(() =>
  import('../views/docs/DocsStudio').then((m) => ({ default: m.DocsStudio })),
)
const AgentScreen = lazy(() =>
  import('../views/agent/AgentLauncher').then((m) => ({ default: m.AgentScreen })),
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
  { to: '/docs', label: 'Documents', icon: FileText },
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
    <div className="flex h-full flex-col overflow-hidden bg-canvas">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <nav className="hidden w-[var(--rail-w)] shrink-0 border-r border-border bg-surface px-3 py-4 md:block" aria-label="Primary">
          <div className="mb-4 px-3">
            <p className="label-caps">Admin workspace</p>
            <p className="mt-1 text-xs leading-relaxed text-fg-muted">Failures and policy exceptions, before volume.</p>
          </div>
          {RAIL.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                [
                  'relative mb-1 flex min-h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-[color,background-color,transform] duration-[var(--motion-fast)]',
                  isActive
                    ? 'signal-edge bg-accent-subtle text-accent'
                    : 'text-fg-muted hover:translate-x-0.5 hover:bg-surface-sunk hover:text-fg',
                ].join(' ')
              }
            >
              <t.icon aria-hidden size={16} strokeWidth={1.75} />
              {t.label}
            </NavLink>
          ))}
        </nav>
        <main className="app-grid min-w-0 flex-1 overflow-y-auto">
          <Suspense fallback={<LazyFallback />}>
            <Routes>
              <Route index element={<Health />} />
              <Route path="inbox" element={<AdminInbox />} />
              <Route path="crm" element={<CrmScreen />} />
              <Route path="dashboard" element={<DashboardScreen />} />
              <Route path="agent" element={<AgentScreen />} />
              <Route path="docs" element={<DocsStudio />} />
              <Route path="leads" element={<Navigate to="/crm" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </main>
      </div>
      <nav className="grid shrink-0 grid-cols-5 border-t border-border bg-surface md:hidden" aria-label="Primary">
        {RAIL.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) => [
              'flex min-h-14 flex-col items-center justify-center gap-1 text-2xs font-medium',
              isActive ? 'text-accent' : 'text-fg-subtle',
            ].join(' ')}
          >
            <t.icon aria-hidden size={18} />
            <span className="max-w-full truncate px-1">{t.label === 'Documents' ? 'Docs' : t.label === 'Health' ? 'Status' : t.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
