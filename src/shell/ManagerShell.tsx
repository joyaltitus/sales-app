import { lazy, Suspense } from 'react'
import { NavLink, Route, Routes, Navigate } from 'react-router-dom'
import { Rows3, Inbox, Users, LayoutDashboard } from 'lucide-react'
import { TopBar } from './TopBar'
import { Skeleton } from '../ui/Skeleton'
import { Floor, ManagerInbox } from '../views/manager/screens'

// SA-04: CRM + Dashboard are lazy — they are desktop-role surfaces with their
// own weight (charts, board), and the rep bundle must never pay for them.
const CrmScreen = lazy(() =>
  import('../views/crm/CrmScreen').then((m) => ({ default: m.CrmScreen })),
)
const DashboardScreen = lazy(() =>
  import('../views/dashboard/DashboardScreen').then((m) => ({ default: m.DashboardScreen })),
)

// Manager view: desktop-first (works on phone). Left rail nav, fixed shell.
//
// SA-04 rail change (ruling 2026-07-30, §S6): `Leads` folded into CRM as its
// Pipeline tab; the `Assign` and `Analytics` stubs are gone — Analytics is
// superseded by Dashboard, and the assignment UI (mock, unwired) lives on the
// CRM pipeline per the Wave-1 backlog. Old paths redirect, nothing 404s.
const RAIL = [
  { to: '/', label: 'Floor', icon: Rows3, end: true },
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

export function ManagerShell() {
  return (
    <div className="flex h-full flex-col bg-canvas">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <nav
          className="w-48 shrink-0 border-r border-border bg-surface p-2"
          aria-label="Primary"
        >
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
              <Route index element={<Floor />} />
              <Route path="inbox" element={<ManagerInbox />} />
              <Route path="crm" element={<CrmScreen />} />
              <Route path="dashboard" element={<DashboardScreen />} />
              {/* Pre-SA-04 paths — keep deep links alive. */}
              <Route path="leads" element={<Navigate to="/crm" replace />} />
              <Route path="assign" element={<Navigate to="/crm" replace />} />
              <Route path="analytics" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </div>
  )
}
