import { lazy, Suspense } from 'react'
import { NavLink, Route, Routes, Navigate } from 'react-router-dom'
import { Activity, Inbox, Users, LayoutDashboard, FileText, Wrench, UsersRound, Settings, Target, SlidersHorizontal, TrendingUp, ShieldCheck, Rocket, Megaphone, FileCheck2 } from 'lucide-react'
import { useClient } from './ClientProvider'
import { useQueue } from '../lib/inbox-data'
import { TopBar } from './TopBar'
import { Skeleton } from '../ui/Skeleton'
import { ErrorBoundary } from '../ui/ErrorBoundary'
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
  import('../views/agent/AgentScreen').then((m) => ({ default: m.AgentScreen })),
)
const DashboardScreen = lazy(() =>
  import('../views/dashboard/DashboardScreen').then((m) => ({ default: m.DashboardScreen })),
)
const Teardown = lazy(() => import('../views/manager/Teardown').then((m) => ({ default: m.Teardown })))
const TeamPage = lazy(() => import('../views/team/TeamPage').then((m) => ({ default: m.TeamPage })))
const TargetsPage = lazy(() => import('../views/targets/TargetsPage').then((m) => ({ default: m.TargetsPage })))
const AdminSettings = lazy(() => import('../views/settings/AiFeaturesCard').then((m) => ({ default: m.AdminSettings })))
// ACCESS-01 C3: the configuration surface (AT-29), the ROI/sightings pair
// (AT-30) and the manager approval queue. Lazy like every other non-landing
// screen — the manage view carries five tabs and belongs nowhere near the
// first paint.
const ManageView = lazy(() => import('../views/manage/ManageView').then((m) => ({ default: m.ManageView })))
// S2-E2: the go-live gate sits beside the setup it grades. client_admin only —
// pm_ack_go_live_item walls there, so a manager would get a page of buttons
// that all answer forbidden.
const GoLive = lazy(() => import('../views/manage/GoLive').then((m) => ({ default: m.GoLive })))
// S2-E1: outbound. Broadcasts writes rows the hub's outreach lanes drain;
// Templates is the read-only registry those sends pick from (wa_templates_write
// is super_admin, so there is nothing here for a client to save). Reps see
// neither — a blast is not a rep-scoped action.
const Broadcasts = lazy(() => import('../views/outbound/Broadcasts').then((m) => ({ default: m.Broadcasts })))
const OutboundTemplates = lazy(() => import('../views/outbound/Templates').then((m) => ({ default: m.Templates })))
const AttributionView = lazy(() => import('../views/attribution/AttributionView').then((m) => ({ default: m.AttributionView })))
const ApprovalsView = lazy(() => import('../views/approvals/ApprovalsView').then((m) => ({ default: m.ApprovalsView })))

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
  { to: '/team', label: 'Team', icon: UsersRound },
  { to: '/approvals', label: 'Approvals', icon: ShieldCheck },
  { to: '/broadcasts', label: 'Broadcasts', icon: Megaphone },
  { to: '/templates', label: 'Templates', icon: FileCheck2 },
  { to: '/setup', label: 'Setup', icon: SlidersHorizontal },
  { to: '/go-live', label: 'Go live', icon: Rocket },
  { to: '/attribution', label: 'Attribution', icon: TrendingUp },
  { to: '/targets', label: 'Targets', icon: Target },
  { to: '/teardown', label: 'Teardown', icon: Wrench },
  { to: '/settings', label: 'Settings', icon: Settings },
]

// AT-26: this shell is mounted at /admin, so its rail links and its internal
// redirects carry the prefix. The RAIL entries stay shell-relative (that is
// what the mobile bar and the `end` flag read) and get prefixed at the one
// place each is turned into an href.
const BASE = '/admin'
const href = (to: string) => (to === '/' ? BASE : BASE + to)

function LazyFallback() {
  return (
    <div className="space-y-2 p-4">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  )
}

export function AdminShell() {
  const { activeClient } = useClient()
  const { items: queueItems } = useQueue(activeClient?.id ?? null)
  const unreadInboxCount = queueItems.filter((i) => i.unread_count > 0).length

  return (
    <div className="flex h-full flex-col overflow-hidden bg-canvas">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <nav className="hidden w-[var(--rail-w)] shrink-0 border-r border-border bg-surface px-3 py-4 md:block" aria-label="Primary">
          <div className="mb-4 px-3">
            <p className="label-caps">Admin workspace</p>
          </div>
          {RAIL.map((t) => (
            <NavLink
              key={t.to}
              to={href(t.to)}
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
              <span>{t.label}</span>
              {t.to === '/inbox' && unreadInboxCount > 0 && (
                <span
                  className="tnum ml-auto inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-pill bg-accent px-1.5 text-[11px] font-bold text-accent-fg shadow-xs"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  {unreadInboxCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <main className="app-grid min-w-0 flex-1 overflow-y-auto">
          <ErrorBoundary>
            <Suspense fallback={<LazyFallback />}>
              <Routes>
                <Route index element={<Health />} />
                <Route path="inbox" element={<AdminInbox />} />
                <Route path="crm" element={<CrmScreen />} />
                <Route path="dashboard" element={<DashboardScreen />} />
                <Route path="agent" element={<AgentScreen />} />
                <Route path="docs" element={<DocsStudio />} />
                <Route path="teardown" element={<Teardown />} />
                <Route path="team" element={<TeamPage />} />
                <Route path="approvals" element={<ApprovalsView />} />
                <Route path="broadcasts" element={<Broadcasts />} />
                <Route path="templates" element={<OutboundTemplates />} />
                <Route path="setup" element={<ManageView />} />
                <Route path="go-live" element={<GoLive />} />
                <Route path="attribution" element={<AttributionView />} />
                <Route path="targets" element={<TargetsPage />} />
                <Route path="settings" element={<AdminSettings />} />
                <Route path="leads" element={<Navigate to={href('/crm')} replace />} />
                <Route path="*" element={<Navigate to={href('/')} replace />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
      <nav className="grid shrink-0 grid-flow-col auto-cols-fr border-t border-border bg-surface md:hidden" aria-label="Primary">
        {RAIL.map((t) => (
          <NavLink
            key={t.to}
            to={href(t.to)}
            end={t.end}
            className={({ isActive }) => [
              'flex min-h-14 flex-col items-center justify-center gap-1 text-2xs font-medium',
              isActive ? 'text-accent' : 'text-fg-subtle',
            ].join(' ')}
          >
            <div className="relative">
              <t.icon aria-hidden size={18} />
              {t.to === '/inbox' && unreadInboxCount > 0 && (
                <span
                  className="tnum absolute -top-1 -right-2.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-pill bg-accent px-1 text-[10px] font-bold leading-none text-accent-fg shadow-xs"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  {unreadInboxCount}
                </span>
              )}
            </div>
            <span className="max-w-full truncate px-1">{t.label === 'Documents' ? 'Docs' : t.label === 'Health' ? 'Status' : t.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
