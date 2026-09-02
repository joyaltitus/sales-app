import { lazy, Suspense } from 'react'
import { NavLink, Route, Routes, Navigate } from 'react-router-dom'
import { Rows3, Inbox, Users, LayoutDashboard, FileText, CircleDot, Sparkles, Wrench, UsersRound, Target } from 'lucide-react'
import { useClient } from './ClientProvider'
import { useQueue } from '../lib/inbox-data'
import { TopBar } from './TopBar'
import { Skeleton } from '../ui/Skeleton'
import { ErrorBoundary } from '../ui/ErrorBoundary'
import { Floor, ManagerInbox } from '../views/manager/screens'

// SA-04: CRM + Dashboard are lazy — they are desktop-role surfaces with their
// own weight (charts, board), and the rep bundle must never pay for them.
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
  { to: '/docs', label: 'Documents', icon: FileText },
  { to: '/team', label: 'Team', icon: UsersRound },
  { to: '/targets', label: 'Targets', icon: Target },
  { to: '/teardown', label: 'Teardown', icon: Wrench },
]

// AT-26: mounted at /manage — see the note in AdminShell.
const BASE = '/manage'
const href = (to: string) => (to === '/' ? BASE : BASE + to)

function LazyFallback() {
  return (
    <div className="space-y-2 p-4">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  )
}

export function ManagerShell() {
  const { activeClient } = useClient()
  const { items: queueItems } = useQueue(activeClient?.id ?? null)
  const unreadInboxCount = queueItems.filter((i) => i.unread_count > 0).length

  return (
    <div className="flex h-full flex-col overflow-hidden bg-canvas">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <nav
          className="hidden w-[var(--rail-w)] shrink-0 flex-col border-r border-border bg-surface px-3 py-4 md:flex"
          aria-label="Primary"
        >
          <div className="mb-4 px-3">
            <p className="label-caps">Workspace</p>
            <p className="mt-1 text-xs leading-relaxed text-fg-muted">Exceptions first. Everything else second.</p>
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
              <t.icon aria-hidden size={17} strokeWidth={1.8} />
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
          <div className="mt-auto rounded-lg border border-border bg-[linear-gradient(145deg,var(--surface-raised),var(--surface-sunk))] p-3 shadow-elev-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-fg">
              <span className="relative flex h-7 w-7 items-center justify-center rounded-md bg-accent-subtle text-accent">
                <Sparkles aria-hidden size={14} />
                <CircleDot aria-hidden size={7} className="absolute -right-0.5 -bottom-0.5 fill-signal text-signal" />
              </span>
              AI is standing by
            </div>
            <p className="mt-2 text-2xs leading-relaxed text-fg-muted">Drafts, summaries and approvals stay reviewable.</p>
          </div>
        </nav>
        <main className="app-grid min-w-0 flex-1 overflow-y-auto">
          <ErrorBoundary>
            <Suspense fallback={<LazyFallback />}>
              <Routes>
                <Route index element={<Floor />} />
                <Route path="inbox" element={<ManagerInbox />} />
                <Route path="crm" element={<CrmScreen />} />
                <Route path="dashboard" element={<DashboardScreen />} />
                <Route path="agent" element={<AgentScreen />} />
                <Route path="docs" element={<DocsStudio />} />
                <Route path="teardown" element={<Teardown />} />
                <Route path="team" element={<TeamPage />} />
                <Route path="targets" element={<TargetsPage />} />
                {/* Pre-SA-04 paths — keep deep links alive. */}
                <Route path="leads" element={<Navigate to={href('/crm')} replace />} />
                <Route path="assign" element={<Navigate to={href('/crm')} replace />} />
                <Route path="analytics" element={<Navigate to={href('/dashboard')} replace />} />
                <Route path="*" element={<Navigate to={href('/')} replace />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
      <nav className="grid shrink-0 grid-cols-8 border-t border-border bg-surface md:hidden" aria-label="Primary">
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
            <span className="max-w-full truncate px-1">{t.label === 'Documents' ? 'Docs' : t.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
