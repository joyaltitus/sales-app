import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { CircleAlert } from 'lucide-react'
import { drainOutbox } from '../lib/outbox-store'
import { checkPanelSession } from '../lib/session'
import { panelSupabase } from '../lib/panel-client'
import { AUTH_NEEDS_SIGNIN_KEY } from '../lib/storage'
import { loadPanelIdentity, type PanelIdentity } from '../lib/panel-data'
import { Button } from '../../src/ui/Button'
import { Input } from '../../src/ui/Input'
import { QueueSkeleton } from '../ui/Skeletons'

type AuthState = 'checking' | 'signed_in' | 'signed_out' | 'refresh_failed'

export function AuthGate({ children }: { children: (identity: PanelIdentity) => ReactNode }) {
  const [state, setState] = useState<AuthState>('checking')
  const [message, setMessage] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [identity, setIdentity] = useState<PanelIdentity | null>(null)

  useEffect(() => {
    let alive = true
    void chrome.storage.local.get(AUTH_NEEDS_SIGNIN_KEY).then(async (stored) => {
      if (!alive) return
      if (stored[AUTH_NEEDS_SIGNIN_KEY] === true) { setState('refresh_failed'); return }
      const result = await checkPanelSession()
      if (!alive) return
      if (result.ok) {
        const nextIdentity = await loadPanelIdentity(result.session)
        if (!nextIdentity) {
          setMessage('Ask an administrator to add this account to a client workspace, then sign in again.')
          setState('signed_out')
          return
        }
        setIdentity(nextIdentity)
        setState('signed_in')
        void drainOutbox()
      } else {
        setMessage(result.reason === 'refresh_failed' ? 'Check your connection, then sign in again.' : null)
        setState(result.reason)
      }
    })
    const { data } = panelSupabase.auth.onAuthStateChange((event, session) => {
      if (!alive || event === 'INITIAL_SESSION') return
      if (!session) { setIdentity(null); setState('signed_out'); return }
      void loadPanelIdentity(session).then((nextIdentity) => {
        setIdentity(nextIdentity)
        setState(nextIdentity ? 'signed_in' : 'signed_out')
      })
    })
    const storageChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'local' && changes[AUTH_NEEDS_SIGNIN_KEY]?.newValue === true) setState('refresh_failed')
    }
    chrome.storage.onChanged.addListener(storageChanged)
    const online = () => { void checkPanelSession().then((result) => { if (result.ok) void drainOutbox() }) }
    window.addEventListener('online', online)
    return () => {
      alive = false
      data.subscription.unsubscribe()
      chrome.storage.onChanged.removeListener(storageChanged)
      window.removeEventListener('online', online)
    }
  }, [])

  async function signIn(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setMessage(null)
    const { error } = await panelSupabase.auth.signInWithPassword({ email, password })
    setSubmitting(false)
    if (error) setMessage("We couldn't sign you in. Check your email and password, then try again.")
    else await chrome.storage.local.remove(AUTH_NEEDS_SIGNIN_KEY)
  }

  if (state === 'checking') return <main aria-busy="true"><QueueSkeleton /></main>
  if (state === 'signed_in' && identity) return children(identity)

  return (
    <main className="grid gap-4 p-5">
      <h1 className="text-lg font-semibold tracking-[-0.035em] text-fg">{state === 'refresh_failed' ? 'Sign in again' : 'Sign in'}</h1>
      {state === 'refresh_failed' && (
        <p role="alert" className="flex items-start gap-2 rounded-md bg-warn-subtle px-3 py-2 text-xs leading-relaxed text-warn">
          <CircleAlert aria-hidden size={14} strokeWidth={1.9} className="mt-0.5 shrink-0" />
          Your session could not be refreshed. Offline changes are still safely queued.
        </p>
      )}
      {message && <p role="alert" className="rounded-md bg-danger-subtle px-3 py-2 text-xs leading-relaxed text-danger">{message}</p>}
      <form onSubmit={signIn} className="grid gap-3">
        <label className="grid gap-1"><span className="label-caps">Email</span><Input required type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label className="grid gap-1"><span className="label-caps">Password</span><Input required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        <Button type="submit" className="mt-1 min-h-11 w-full" loading={submitting}>{submitting ? 'Signing in…' : 'Sign in'}</Button>
      </form>
    </main>
  )
}
