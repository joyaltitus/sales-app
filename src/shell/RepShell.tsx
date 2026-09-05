import { lazy, Suspense, useState } from 'react'
import { NavLink, Route, Routes, Navigate } from 'react-router-dom'
import { Home, Inbox, Kanban, Ellipsis, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useClient } from './ClientProvider'
import { useFeatureGrants, featureOn } from '../lib/featureOn'
import { useQueue } from '../lib/inbox-data'
import { TopBar } from './TopBar'
import { Skeleton } from '../ui/Skeleton'
import { ErrorBoundary } from '../ui/ErrorBoundary'
import { Today, RepInbox, More, ProductAiDoor } from '../views/rep/screens'

// SA-05 (Joyal's ruling 2026-07-30, supersedes SA-04's "rep gets no CRM"):
// the Leads tab now mounts the full CRM — reps see their own + unassigned
// leads (scoped in LeadsScreen, rendering-only; RLS unchanged). Lazy, same as
// the desktop shells, so the rep's first load doesn't pay for it.
const CrmScreen = lazy(() =>
  import('../views/crm/CrmScreen').then((m) => ({ default: m.CrmScreen })),
)
// UI-BUILD-02: full-screen agent surface (phone entry from the TopBar launcher).
const AgentScreen = lazy(() =>
  import('../views/agent/AgentScreen').then((m) => ({ default: m.AgentScreen })),
)
const DocsStudio = lazy(() =>
  import('../views/docs/DocsStudio').then((m) => ({ default: m.DocsStudio })),
)

// Rep view: phone-first. Fixed bottom tab bar, 4 tabs max (§C). Content-only
// transitions; the shell never moves.
const TABS = [
  { to: '/', label: 'Today', icon: Home, end: true },
  { to: '/inbox', label: 'Inbox', icon: Inbox },
  { to: '/leads', label: 'Leads', icon: Kanban },
  { to: '/more', label: 'More', icon: Ellipsis },
]

// AT-26: mounted at /rep — see the note in AdminShell.
const BASE = '/rep'
const href = (to: string) => (to === '/' ? BASE : BASE + to)

export function RepShell() {
  const { activeClient } = useClient()
  const { grants } = useFeatureGrants(activeClient?.id ?? null)
  const { items: queueItems } = useQueue(activeClient?.id ?? null)
  const unreadInboxCount = queueItems.filter((i) => i.unread_count > 0).length
  // hub #276: this door used to read a jsonb column on `clients`, a second door
  // register that 069 replaced. `feature_grants` is the one entitlement source
  // now — same key, same "no row = hidden" default, plus the role test the
  // grants table carries. The old column is dropped hub-side once this deploys.
  const productAi = featureOn(grants, 'product_ai', activeClient?.role)
  const [collapsed, setCollapsed] = useState(
    () => typeof window !== 'undefined' && window.localStorage.getItem('sa:rep-sidebar-collapsed') === '1',
  )
  const toggleCollapsed = () =>
    setCollapsed((v) => {
      const next = !v
      window.localStorage.setItem('sa:rep-sidebar-collapsed', next ? '1' : '0')
      return next
    })

  return (
    <div className="flex h-full flex-col overflow-hidden bg-canvas">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-accent focus:shadow-elev-2"
      >
        Skip to content
      </a>
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <div className="relative hidden lg:block">
          <aside
            aria-label="My workspace"
            className={[
              'flex h-full shrink-0 flex-col overflow-hidden border-r border-border bg-surface py-4 transition-[width] duration-150',
              collapsed ? 'w-0 border-r-0 px-0' : 'w-[216px] px-3',
            ].join(' ')}
          >
            <div className="w-[192px] px-3 pb-4">
              <p className="label-caps text-accent">My workspace</p>
            </div>
            <nav className="w-[192px] space-y-1" aria-label="Rep workspace">
              {TABS.map((tab) => (
                <NavLink
                  key={tab.to}
                  to={href(tab.to)}
                  end={tab.end}
                  className={({ isActive }) => [
                    'flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition-colors',
                    isActive ? 'bg-accent-subtle text-accent' : 'text-fg-muted hover:bg-surface-sunk hover:text-fg',
                  ].join(' ')}
                >
                  <tab.icon aria-hidden size={18} strokeWidth={1.8} />
                  <span>{tab.label}</span>
                  {tab.to === '/inbox' && unreadInboxCount > 0 && (
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
          </aside>

          <button
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Show sidebar' : 'Hide sidebar'}
            title={collapsed ? 'Show sidebar' : 'Hide sidebar'}
            className="absolute top-1/2 z-10 -translate-y-1/2 rounded-full border border-border bg-surface p-1 text-fg-muted shadow-elev-1 transition-colors hover:text-fg"
            style={{ left: collapsed ? '8px' : '204px' }}
          >
            {collapsed ? <PanelLeftOpen aria-hidden size={14} /> : <PanelLeftClose aria-hidden size={14} />}
          </button>
        </div>

        <main id="main-content" className="min-h-0 min-w-0 flex-1 overflow-y-auto pb-24 lg:pb-0">
          <ErrorBoundary>
            <Suspense
              fallback={
                <div className="space-y-2 p-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              }
            >
              <Routes>
                <Route index element={<Today />} />
                <Route path="inbox" element={<RepInbox />} />
                <Route path="leads" element={<CrmScreen />} />
                <Route path="more" element={<More productAi={productAi} />} />
                <Route path="agent" element={<AgentScreen />} />
                <Route path="docs" element={<DocsStudio />} />
                {/* Flag-gated door: only mounts when the flag is on. */}
                {productAi && <Route path="more/product-ai" element={<ProductAiDoor />} />}
                <Route path="*" element={<Navigate to={href('/')} replace />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>

      <nav
        className="fixed inset-x-3 bottom-3 z-30 grid grid-cols-4 overflow-hidden rounded-xl border border-border bg-surface-glass px-1 pb-[env(safe-area-inset-bottom)] shadow-elev-3 backdrop-blur-xl sm:inset-x-auto sm:left-1/2 sm:w-[440px] sm:-translate-x-1/2 lg:hidden"
        aria-label="Primary"
      >
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={href(t.to)}
            end={t.end}
            className={({ isActive }) =>
              [
                // Active = colour + weight + a 2px indicator bar — never colour
                // alone (audit A17, CVD).
                'relative flex min-h-[3.5rem] flex-col items-center justify-center gap-1 rounded-lg py-2 text-2xs transition-[color,background-color,transform] duration-[var(--motion-fast)]',
                isActive
                  ? 'bg-accent-subtle font-semibold text-accent'
                  : 'font-medium text-fg-subtle hover:bg-surface-sunk hover:text-fg active:scale-[0.98]',
              ].join(' ')
            }
          >
            <div className="relative">
              <t.icon aria-hidden size={19} strokeWidth={1.8} />
              {t.to === '/inbox' && unreadInboxCount > 0 && (
                <span
                  className="tnum absolute -top-1 -right-2.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-pill bg-accent px-1 text-[10px] font-bold leading-none text-accent-fg shadow-xs"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  {unreadInboxCount}
                </span>
              )}
            </div>
            {t.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
