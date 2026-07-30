import { NavLink, Route, Routes, Navigate } from 'react-router-dom'
import { Home, Inbox, Kanban, Ellipsis } from 'lucide-react'
import { useClient } from './ClientProvider'
import { useFlags, flagOn } from '../lib/flags'
import { TopBar } from './TopBar'
import { Today, RepInbox, Leads, More, ProductAiDoor } from '../views/rep/screens'

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
        <Routes>
          <Route index element={<Today />} />
          <Route path="inbox" element={<RepInbox />} />
          <Route path="leads" element={<Leads />} />
          <Route path="more" element={<More productAi={productAi} />} />
          {/* Flag-gated door: only mounts when the flag is on. */}
          {productAi && <Route path="more/product-ai" element={<ProductAiDoor />} />}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
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
                'flex min-h-[3rem] flex-col items-center justify-center gap-0.5 py-2 text-2xs font-medium transition-colors',
                isActive ? 'text-accent' : 'text-fg-subtle hover:text-fg-muted',
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
