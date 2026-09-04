import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  CircleAlert,
  Clock3,
  KeyRound,
  Mail,
  ShieldCheck,
  WifiOff,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthProvider'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { ProductMark } from '../ui/ProductMark'

type AuthView = 'login' | 'recovery'
type AuthFailureKind = 'invalid_credentials' | 'rate_limited' | 'network'

const AUTH_FAILURE_COPY: Record<AuthFailureKind, { title: string; body: string }> = {
  invalid_credentials: { title: 'That email and password don’t match.', body: 'Check both fields or reset your password.' },
  rate_limited: { title: 'Too many attempts. Try again shortly.', body: 'Wait a few minutes before retrying.' },
  network: { title: 'We couldn’t reach the sign-in service.', body: 'Check your connection and try again.' },
}

/** Neutral product glyph: identity without inventing a working product name. */
export function Wordmark({ size = 40 }: { size?: number }) {
  return <ProductMark size={size} />
}

function inferFailure(message: string): AuthFailureKind {
  const normalized = message.toLowerCase()
  if (normalized.includes('rate') || normalized.includes('too many')) return 'rate_limited'
  if (normalized.includes('invalid') || normalized.includes('credential') || normalized.includes('password')) return 'invalid_credentials'
  return 'network'
}

function AuthNotice({ kind }: { kind: AuthFailureKind }) {
  const copy = AUTH_FAILURE_COPY[kind]
  const Icon = kind === 'network' ? WifiOff : kind === 'rate_limited' ? Clock3 : CircleAlert
  return (
    <div className="mb-4 flex gap-3 rounded-lg border border-danger/30 bg-danger-subtle p-3 text-danger" role="alert">
      <Icon aria-hidden size={17} className="mt-0.5 shrink-0" />
      <div>
        <p className="text-xs font-semibold">{copy.title}</p>
        <p className="mt-1 text-2xs leading-relaxed text-danger">{copy.body}</p>
      </div>
    </div>
  )
}

function CardHeading({ eyebrow, title, body, icon }: { eyebrow?: ReactNode; title: string; body: string; icon?: ReactNode }) {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between gap-3">
        {icon ? <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-surface-raised text-accent shadow-elev-1">{icon}</span> : <Wordmark size={42} />}
        {eyebrow}
      </div>
      <h1 className="mt-5 text-xl font-semibold tracking-[-0.04em] text-fg">{title}</h1>
      <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">{body}</p>
    </div>
  )
}

export function LoginCard({
  email,
  password,
  error,
  busy,
  onEmail,
  onPassword,
  onSubmit,
  onForgot,
}: {
  email: string
  password: string
  error: string | null
  busy: boolean
  onEmail: (value: string) => void
  onPassword: (value: string) => void
  onSubmit: (event: FormEvent) => void
  onForgot?: () => void
}) {
  const failure = error ? inferFailure(error) : null
  return (
    <form onSubmit={onSubmit} className="w-full rounded-xl border border-border bg-surface p-6 shadow-elev-3 sm:p-7">
      <CardHeading
        title="Sign in"
        body="Use your work email and password."
        eyebrow={<span className="flex items-center gap-1.5 text-2xs font-semibold text-success"><ShieldCheck aria-hidden size={13} /> Protected</span>}
      />

      {failure && <AuthNotice kind={failure} />}

      <label htmlFor="login-email" className="mb-1.5 block text-xs font-medium text-fg-muted">Work email</label>
      <Input
        id="login-email"
        name="email"
        type="email"
        inputMode="email"
        autoCapitalize="none"
        autoComplete="email"
        autoFocus
        value={email}
        onChange={(event) => onEmail(event.target.value)}
        required
        invalid={failure === 'invalid_credentials'}
        placeholder="you@company.com"
      />

      <div className="mt-4 flex items-end justify-between gap-3">
        <label htmlFor="login-password" className="block text-xs font-medium text-fg-muted">Password</label>
        {onForgot && <button type="button" onClick={onForgot} className="text-2xs font-semibold text-accent hover:underline">Forgot password?</button>}
      </div>
      <Input
        id="login-password"
        name="password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(event) => onPassword(event.target.value)}
        required
        invalid={failure === 'invalid_credentials'}
        className="mt-1.5"
        placeholder="Enter your password"
      />

      <Button type="submit" size="lg" loading={busy} className="mt-5 w-full">
        {busy ? 'Signing you in…' : 'Sign in'} {!busy && <ArrowRight aria-hidden size={15} />}
      </Button>

    </form>
  )
}

function BackButton({ onClick }: { onClick: () => void }) {
  return <button type="button" onClick={onClick} className="mb-5 inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 text-xs font-semibold text-fg-muted hover:bg-surface-sunk hover:text-fg"><ArrowLeft aria-hidden size={14} /> Back to sign in</button>
}

function RecoveryFlow({
  onBack,
  onRequestReset,
}: {
  onBack: () => void
  onRequestReset: (email: string) => void
}) {
  const [step, setStep] = useState<'request' | 'sent'>('request')
  const [email, setEmail] = useState('')
  const submit = (event: FormEvent) => {
    event.preventDefault()
    onRequestReset(email)
    setStep('sent')
  }
  if (step === 'sent') return (
    <div className="w-full rounded-xl border border-border bg-surface p-6 shadow-elev-3 sm:p-7">
      <BackButton onClick={onBack} />
      <CardHeading icon={<Mail aria-hidden size={20} />} title="Check your inbox" body={`If ${email} belongs to a workspace, a secure reset link is on its way.`} />
      <div className="rounded-lg border border-info/25 bg-info-subtle p-4 text-xs leading-relaxed text-info">Follow the instructions in the email to choose a new password.</div>
      <button type="button" onClick={() => setStep('request')} className="mt-4 w-full text-center text-xs font-semibold text-fg-muted hover:text-fg">Use a different email</button>
    </div>
  )
  return (
    <form onSubmit={submit} className="w-full rounded-xl border border-border bg-surface p-6 shadow-elev-3 sm:p-7">
      <BackButton onClick={onBack} />
      <CardHeading icon={<Mail aria-hidden size={20} />} title="Reset password" body="Enter your work email. We’ll send a reset link if it matches a workspace." />
      <label htmlFor="recovery-email" className="mb-1.5 block text-xs font-medium text-fg-muted">Work email</label>
      <Input id="recovery-email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
      <Button type="submit" size="lg" className="mt-5 w-full">Send secure link <ArrowRight aria-hidden size={15} /></Button>
    </form>
  )
}

/** The real reset landing: Supabase's redirect brings the rep back here with
 *  a recovery session already established (PASSWORD_RECOVERY event, caught
 *  by AuthProvider's existing listener). This is not reachable by navigating
 *  the app — Gate renders it whenever that flag is set, regardless of path. */
export function PasswordRecoveryScreen() {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { clearPasswordRecovery } = useAuth()

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(error.message)
      setBusy(false)
      return
    }
    // Recovery sessions authenticate like any other — sign back out so the
    // rep re-enters with their new password rather than staying silently
    // logged in on whatever device opened the email link.
    await supabase.auth.signOut()
    clearPasswordRecovery()
  }

  return (
    <AuthShell>
      <form onSubmit={submit} className="w-full rounded-xl border border-border bg-surface p-6 shadow-elev-3 sm:p-7">
        <CardHeading icon={<KeyRound aria-hidden size={20} />} title="Choose a new password." body="This reset link is valid. Create a password you haven’t used here before." />
        {error && <AuthNotice kind={inferFailure(error)} />}
        <label htmlFor="recovery-new-password" className="mb-1.5 block text-xs font-medium text-fg-muted">New password</label>
        <Input id="recovery-new-password" type="password" autoComplete="new-password" minLength={10} value={password} onChange={(event) => setPassword(event.target.value)} required placeholder="10+ characters" />
        <p className="mt-2 text-2xs text-fg-muted">Use 10 or more characters. Password managers and browser autofill are supported.</p>
        <Button type="submit" size="lg" loading={busy} className="mt-5 w-full" disabled={password.length < 10}>Update password <ArrowRight aria-hidden size={15} /></Button>
      </form>
    </AuthShell>
  )
}

function ProductPromise() {
  return (
    <section className="relative overflow-hidden rounded-xl border border-border bg-surface/90 p-6 shadow-elev-2 sm:p-8 lg:min-h-[570px] lg:p-10" aria-label="Product introduction">
      <div className="absolute inset-x-0 top-[34%] h-px bg-border" aria-hidden />
      <div className="relative flex h-full flex-col">
        <div className="flex items-center gap-3"><Wordmark size={48} /><p className="text-sm font-semibold text-fg">Sales workspace</p></div>
        <div className="my-auto py-10">
          <h2 className="max-w-xl text-3xl font-semibold tracking-[-0.055em] text-fg">Customer work</h2>
          <p className="mt-4 max-w-lg text-md leading-relaxed text-fg-muted">Conversations, follow-ups, team decisions, and revenue reporting.</p>
        </div>
        <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3">
          {[['01', 'Customer context', 'WhatsApp, Instagram and email'], ['02', 'Next action', 'A clear owner and promise'], ['03', 'Business signal', 'Pipeline, bookings and risk']].map(([number, title, body]) => <article key={number} className="bg-surface p-4"><span className="tnum text-2xs font-semibold text-accent">{number}</span><p className="mt-3 text-xs font-semibold text-fg">{title}</p><p className="mt-1 text-2xs leading-relaxed text-fg-muted">{body}</p></article>)}
        </div>
      </div>
    </section>
  )
}

function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="app-grid relative min-h-full overflow-hidden bg-canvas px-4 py-6 sm:px-6 lg:flex lg:items-center lg:py-10">
      <span aria-hidden className="absolute top-[-18%] right-[-12%] h-[520px] w-[520px] rounded-full bg-accent-subtle opacity-60 blur-3xl" />
      <span aria-hidden className="absolute bottom-[-24%] left-[-10%] h-[420px] w-[420px] rounded-full bg-info-subtle opacity-40 blur-3xl" />
      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="hidden lg:block"><ProductPromise /></div>
        <div className="flex flex-col items-center">
          <div className="mb-4 flex w-full items-center gap-3 rounded-xl border border-border bg-surface/90 p-4 shadow-elev-1 lg:hidden"><Wordmark size={42} /><p className="text-sm font-semibold text-fg">Sales workspace</p></div>
          {children}
          <p className="mt-5 flex items-center gap-1.5 text-center text-2xs text-fg-subtle"><ShieldCheck aria-hidden size={12} /> Secure access · Password-manager friendly</p>
        </div>
      </div>
    </main>
  )
}

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [view, setView] = useState<AuthView>('login')

  // Password entry is the user's own — never stored, never logged (unchanged).
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setBusy(false)
  }

  const requestReset = (targetEmail: string) => {
    void supabase.auth.resetPasswordForEmail(targetEmail, {
      redirectTo: window.location.origin,
    })
  }

  return (
    <AuthShell>
      {view === 'login' && <LoginCard email={email} password={password} error={error} busy={busy} onEmail={setEmail} onPassword={setPassword} onSubmit={submit} onForgot={() => setView('recovery')} />}
      {view === 'recovery' && <RecoveryFlow onBack={() => setView('login')} onRequestReset={requestReset} />}
    </AuthShell>
  )
}
