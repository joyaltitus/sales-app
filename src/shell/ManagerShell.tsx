import { NavLink, Route, Routes, Navigate } from 'react-router-dom'
import { TopBar } from './TopBar'
import { Team, ManagerInbox, Assign, Analytics } from '../views/manager/screens'

// Manager view: desktop-first (works on phone). Left rail nav, fixed shell.
const RAIL = [
  { to: '/', label: 'Team', end: true },
  { to: '/inbox', label: 'Inbox' },
  { to: '/assign', label: 'Assign' },
  { to: '/analytics', label: 'Analytics' },
]

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
            <Route index element={<Team />} />
            <Route path="inbox" element={<ManagerInbox />} />
            <Route path="assign" element={<Assign />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
