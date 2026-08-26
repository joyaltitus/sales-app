import { useEffect } from 'react'
import type { CSSProperties } from 'react'
import { MemoryRouter, NavLink, Route, Routes } from 'react-router-dom'
import SettingsScreen from './screens/SettingsScreen'

let rootMounts = 0

export function getRootMounts() {
  return rootMounts
}

function Placeholder({ title }: { title: string }) {
  return <h2>{title}</h2>
}

const TABS = [
  { to: '/queue', label: 'Queue' },
  { to: '/lead', label: 'Lead' },
  { to: '/library', label: 'Library' },
  { to: '/settings', label: 'Settings' },
]

const navLinkStyle = (active: boolean): CSSProperties => ({
  display: 'flex',
  flex: 1,
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 44,
  fontSize: 'var(--text-sm)',
  fontWeight: active ? 650 : 400,
  color: active ? 'var(--accent)' : 'var(--fg-muted)',
  textDecoration: 'none',
})

export default function App() {
  useEffect(() => {
    rootMounts += 1
  }, [])

  return (
    <MemoryRouter initialEntries={['/queue']}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--canvas)', color: 'var(--fg)' }}>
        <main style={{ minHeight: 0, flex: 1, overflowY: 'auto' }}>
          <Routes>
            <Route path="/queue" element={<Placeholder title="Queue" />} />
            <Route path="/lead" element={<Placeholder title="Lead" />} />
            <Route path="/library" element={<Placeholder title="Library" />} />
            <Route path="/settings" element={<SettingsScreen />} />
          </Routes>
        </main>
        <nav style={{ display: 'flex', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
          {TABS.map((tab) => (
            <NavLink key={tab.to} to={tab.to}>
              {({ isActive }) => (
                <span style={{ ...navLinkStyle(isActive), width: '100%' }}>{tab.label}</span>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </MemoryRouter>
  )
}
