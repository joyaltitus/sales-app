import { NavLink, Route, Routes, Navigate } from 'react-router-dom'
import { TopBar } from './TopBar'
import { OnboardingHome } from '../views/onboarding/OnboardingHome'

// Admin view (super_admin + client_admin): consolidation ruling ONB-CON-01F —
// operator console lives HERE, not Workbench. Legacy Workbench stays one click
// away until its pages migrate over (ONB §D: "legacy pages become operator
// pages in the new app").
const WORKBENCH_URL =
  import.meta.env.VITE_WORKBENCH_URL ?? 'https://workbench-admin.zeabur.app'

const RAIL = [{ to: '/', label: 'Onboarding', end: true }]

export function AdminShell() {
  return (
    <div className="flex h-full flex-col bg-canvas">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <nav
          className="flex w-48 shrink-0 flex-col border-r border-border bg-surface p-2"
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
          <a
            href={WORKBENCH_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-auto block rounded-sm px-3 py-2 text-sm font-medium text-fg-muted hover:bg-surface-sunk hover:text-fg"
          >
            Legacy Workbench ↗
          </a>
        </nav>
        <main className="min-w-0 flex-1 overflow-y-auto">
          <Routes>
            <Route index element={<OnboardingHome />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
