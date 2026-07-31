import { lazy, Suspense } from 'react'
import { NavLink, Route, Routes, Navigate } from 'react-router-dom'
import { Home, Inbox, Kanban, Ellipsis } from 'lucide-react'
import { useClient } from './ClientProvider'
import { useFlags, flagOn } from '../lib/flags'
import { TopBar } from './TopBar'
import { Skeleton } from '../ui/Skeleton'
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
  import('../views/agent/AgentLauncher').then((m) => ({ default: m.AgentScreen })),
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

export function RepShell() {
  const { activeClient } = useClient()
  const { flags } = useFlags(activeClient?.id ?? null)
  const productAi = flagOn(flags, 'product_ai')

  return (
    <div className="flex h-full flex-col bg-canvas">
      <TopBar />
      <main className="flex-1 overflow-y-auto pb-16">
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
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-4 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]"
        aria-label="Primary"
      >
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              [
                // Active = colour + weight + a 2px indicator bar — never colour
                // alone (audit A17, CVD).
                'relative flex min-h-[3rem] flex-col items-center justify-center gap-0.5 py-2 text-2xs transition-colors',
                isActive
                  ? 'font-semibold text-accent after:absolute after:top-0 after:h-0.5 after:w-8 after:rounded-pill after:bg-accent'
                  : 'font-medium text-fg-subtle hover:text-fg-muted',
              ].join(' ')
            }
          >
            <t.icon aria-hidden size={20} strokeWidth={1.75} />
            {t.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
