import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { MemoryRouter, NavLink, Route, Routes } from 'react-router-dom'
import SettingsScreen from './screens/SettingsScreen'
import { drainOutbox } from '../lib/outbox-store'
import { checkPanelSession } from '../lib/session'
import { panelSupabase } from '../lib/panel-client'
import { AUTH_NEEDS_SIGNIN_KEY } from '../lib/storage'

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

export function AppShell() {
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

type AuthState = 'checking' | 'signed_in' | 'signed_out' | 'refresh_failed'

export default function App() {
  const [state, setState] = useState<AuthState>('checking')
  const [message, setMessage] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let alive = true
    void chrome.storage.local.get(AUTH_NEEDS_SIGNIN_KEY).then(async (stored) => {
      if (!alive) return
      if (stored[AUTH_NEEDS_SIGNIN_KEY] === true) {
        setState('refresh_failed')
        return
      }
      const result = await checkPanelSession()
      if (!alive) return
      if (result.ok) {
        setState('signed_in')
        void drainOutbox()
      } else {
        setMessage(result.message ?? null)
        setState(result.reason)
      }
    })
    const { data } = panelSupabase.auth.onAuthStateChange((event, session) => {
      if (!alive || event === 'INITIAL_SESSION') return
      setState(session ? 'signed_in' : 'signed_out')
    })
    const storageChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'local' && changes[AUTH_NEEDS_SIGNIN_KEY]?.newValue === true) {
        setState('refresh_failed')
      }
    }
    chrome.storage.onChanged.addListener(storageChanged)
    const online = () => {
      void checkPanelSession().then((result) => {
        if (result.ok) void drainOutbox()
      })
    }
    window.addEventListener('online', online)
    return () => {
      alive = false
      data.subscription.unsubscribe()
      chrome.storage.onChanged.removeListener(storageChanged)
      window.removeEventListener('online', online)
    }
  }, [])

  async function signIn(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setMessage(null)
    const { error } = await panelSupabase.auth.signInWithPassword({ email, password })
    setSubmitting(false)
    if (error) setMessage(error.message)
    else await chrome.storage.local.remove(AUTH_NEEDS_SIGNIN_KEY)
  }

  if (state === 'checking') return <main style={{ padding: 20 }}>Checking session…</main>
  if (state === 'signed_in') return <AppShell />

  return (
    <main style={{ padding: 20, display: 'grid', gap: 16 }}>
      <h1 style={{ margin: 0 }}>{state === 'refresh_failed' ? 'Sign in again' : 'Sign in'}</h1>
      {state === 'refresh_failed' && (
        <p role="alert" style={{ margin: 0, color: 'var(--warn-fg)' }}>
          Your session could not be refreshed. Offline changes are still safely queued.
        </p>
      )}
      {message && <p role="alert" style={{ margin: 0 }}>{message}</p>}
      <form onSubmit={signIn} style={{ display: 'grid', gap: 12 }}>
        <label>Email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label>Password<input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        <button type="submit" disabled={submitting}>{submitting ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </main>
  )
}
