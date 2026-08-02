import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleAlert,
  Clock3,
  KeyRound,
  Mail,
  ShieldCheck,
  WifiOff,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { ProductMark } from '../ui/ProductMark'
import { Sheet } from '../ui/Sheet'
import {
  AUTH_FAILURE_COPY,
  INVITE_PREVIEW,
  RECOVERY_PREVIEW,
  SESSION_EXPIRED_PREVIEW,
} from './authPreviewMocks'
import type { AuthFailureKind } from './authPreviewMocks'

type AuthView = 'login' | 'invite' | 'recovery'

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

function PreviewFlag() {
  return <span className="label-caps rounded-pill border border-dashed border-border-strong px-2 py-1">Preview — not wired</span>
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
  errorKind,
  busy,
  sessionEnded = false,
  onEmail,
  onPassword,
  onSubmit,
  onForgot,
  onInvite,
}: {
  email: string
  password: string
  error: string | null
  errorKind?: AuthFailureKind
  busy: boolean
  sessionEnded?: boolean
  onEmail: (value: string) => void
  onPassword: (value: string) => void
  onSubmit: (event: FormEvent) => void
  onForgot?: () => void
  onInvite?: () => void
}) {
  const failure = errorKind ?? (error ? inferFailure(error) : null)
  return (
    <form onSubmit={onSubmit} className="w-full rounded-xl border border-border bg-surface p-6 shadow-elev-3 sm:p-7">
      <CardHeading
        title="Welcome back"
        body="Sign in to pick up exactly where your team left off."
        eyebrow={<span className="flex items-center gap-1.5 text-2xs font-semibold text-success"><ShieldCheck aria-hidden size={13} /> Protected</span>}
      />

      {sessionEnded && (
        <div className="mb-4 rounded-lg border border-info/25 bg-info-subtle p-3 text-xs leading-relaxed text-info" role="status">
          Your session ended to keep the workspace secure. Sign in again to continue.
        </div>
      )}
      {failure && <AuthNotice kind={failure} />}

      <label htmlFor="login-email" className="label-caps mb-1.5 block">Work email</label>
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
        <label htmlFor="login-password" className="label-caps block">Password</label>
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

      {onInvite && (
        <p className="mt-5 text-center text-xs text-fg-muted">
          Joining a new team?{' '}
          <button type="button" onClick={onInvite} className="font-semibold text-fg hover:text-accent hover:underline">Accept an invitation</button>
        </p>
      )}
    </form>
  )
}

function BackButton({ onClick }: { onClick: () => void }) {
  return <button type="button" onClick={onClick} className="mb-5 inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 text-xs font-semibold text-fg-muted hover:bg-surface-sunk hover:text-fg"><ArrowLeft aria-hidden size={14} /> Back to sign in</button>
}

function InviteFlow({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState<'welcome' | 'password' | 'success'>('welcome')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  if (step === 'success') return (
    <div className="w-full rounded-xl border border-border bg-surface p-6 shadow-elev-3 sm:p-7">
      <CardHeading icon={<Check aria-hidden size={21} />} eyebrow={<PreviewFlag />} title="You’re all set." body={`Your ${INVITE_PREVIEW.role.toLowerCase()} workspace is ready. We’ll take you straight to the team overview.`} />
      <div className="rounded-lg border border-success/25 bg-success-subtle p-4 text-sm text-success">
        <p className="font-semibold">Access confirmed</p>
        <p className="mt-1 text-xs leading-relaxed">{INVITE_PREVIEW.company} · {INVITE_PREVIEW.invitedEmail}</p>
      </div>
      <Button size="lg" className="mt-5 w-full" onClick={onBack}>Continue to team overview <ArrowRight aria-hidden size={15} /></Button>
      <p className="mt-3 text-center text-2xs text-fg-subtle">Preview only — shell handoff is not wired.</p>
    </div>
  )

  return (
    <form onSubmit={(event) => { event.preventDefault(); setStep(step === 'welcome' ? 'password' : 'success') }} className="w-full rounded-xl border border-border bg-surface p-6 shadow-elev-3 sm:p-7">
      <BackButton onClick={onBack} />
      <CardHeading
        icon={step === 'welcome' ? <Mail aria-hidden size={20} /> : <KeyRound aria-hidden size={20} />}
        eyebrow={<PreviewFlag />}
        title={step === 'welcome' ? `You’ve been invited to ${INVITE_PREVIEW.company}.` : 'Create your password.'}
        body={step === 'welcome' ? `${INVITE_PREVIEW.invitedBy} invited you as ${INVITE_PREVIEW.role}. Confirm the details before you join.` : 'Use at least 10 characters. A password manager works here, too.'}
      />
      {step === 'welcome' ? (
        <dl className="divide-y divide-border rounded-lg border border-border bg-surface-sunk px-4">
          {[['Work email', INVITE_PREVIEW.invitedEmail], ['Role', INVITE_PREVIEW.role], ['Invited by', INVITE_PREVIEW.invitedBy]].map(([term, value]) => <div key={term} className="grid grid-cols-[94px_1fr] gap-3 py-3 text-xs"><dt className="text-fg-muted">{term}</dt><dd className="text-right font-semibold text-fg">{value}</dd></div>)}
        </dl>
      ) : (
        <div className="space-y-4">
          <div><label htmlFor="invite-password" className="label-caps mb-1.5 block">New password</label><Input id="invite-password" type="password" autoComplete="new-password" minLength={10} value={password} onChange={(event) => setPassword(event.target.value)} required placeholder="10+ characters" /></div>
          <div><label htmlFor="invite-confirm" className="label-caps mb-1.5 block">Confirm password</label><Input id="invite-confirm" type="password" autoComplete="new-password" minLength={10} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required invalid={confirmation.length > 0 && confirmation !== password} placeholder="Repeat your password" /></div>
          {confirmation.length > 0 && confirmation !== password && <p className="text-2xs font-semibold text-danger" role="alert">The passwords don’t match yet.</p>}
        </div>
      )}
      <Button type="submit" size="lg" className="mt-5 w-full" disabled={step === 'password' && (password.length < 10 || password !== confirmation)}>{step === 'welcome' ? 'Accept invitation' : 'Create account'} <ArrowRight aria-hidden size={15} /></Button>
    </form>
  )
}

function RecoveryFlow({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState<'request' | 'sent' | 'reset' | 'success'>('request')
  const [email, setEmail] = useState(RECOVERY_PREVIEW.email)
  const [password, setPassword] = useState('')
  const submit = (event: FormEvent) => {
    event.preventDefault()
    setStep(step === 'request' ? 'sent' : step === 'reset' ? 'success' : step)
  }
  if (step === 'sent') return (
    <div className="w-full rounded-xl border border-border bg-surface p-6 shadow-elev-3 sm:p-7">
      <BackButton onClick={onBack} />
      <CardHeading icon={<Mail aria-hidden size={20} />} eyebrow={<PreviewFlag />} title="Check your inbox." body={`If ${email} belongs to a workspace, a secure reset link is on its way.`} />
      <div className="rounded-lg border border-info/25 bg-info-subtle p-4 text-xs leading-relaxed text-info">The link expires in {RECOVERY_PREVIEW.expiresInMinutes} minutes. You can safely close this window.</div>
      <Button variant="secondary" size="lg" className="mt-5 w-full" onClick={() => setStep('reset')}>Preview opening the email</Button>
      <button type="button" onClick={() => setStep('request')} className="mt-4 w-full text-center text-xs font-semibold text-fg-muted hover:text-fg">Use a different email</button>
    </div>
  )
  if (step === 'success') return (
    <div className="w-full rounded-xl border border-border bg-surface p-6 shadow-elev-3 sm:p-7">
      <CardHeading icon={<Check aria-hidden size={21} />} eyebrow={<PreviewFlag />} title="Password updated." body="Your new password is ready. Other signed-in devices will be asked to authenticate again." />
      <Button size="lg" className="w-full" onClick={onBack}>Return to sign in <ArrowRight aria-hidden size={15} /></Button>
    </div>
  )
  return (
    <form onSubmit={submit} className="w-full rounded-xl border border-border bg-surface p-6 shadow-elev-3 sm:p-7">
      <BackButton onClick={onBack} />
      <CardHeading icon={step === 'request' ? <Mail aria-hidden size={20} /> : <KeyRound aria-hidden size={20} />} eyebrow={<PreviewFlag />} title={step === 'request' ? 'Reset your password.' : 'Choose a new password.'} body={step === 'request' ? 'Enter your work email. We’ll send a time-limited reset link if it matches a workspace.' : 'This reset link is valid. Create a password you haven’t used here before.'} />
      {step === 'request' ? <><label htmlFor="recovery-email" className="label-caps mb-1.5 block">Work email</label><Input id="recovery-email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></> : <><label htmlFor="reset-password" className="label-caps mb-1.5 block">New password</label><Input id="reset-password" type="password" autoComplete="new-password" minLength={10} value={password} onChange={(event) => setPassword(event.target.value)} required placeholder="10+ characters" /><p className="mt-2 text-2xs text-fg-muted">Use 10 or more characters. Password managers and browser autofill are supported.</p></>}
      <Button type="submit" size="lg" className="mt-5 w-full" disabled={step === 'reset' && password.length < 10}>{step === 'request' ? 'Send secure link' : 'Update password'} <ArrowRight aria-hidden size={15} /></Button>
    </form>
  )
}

export function SessionExpiredPrompt({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const resume = (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    window.setTimeout(() => { setBusy(false); onClose() }, 550)
  }
  return (
    <Sheet open={open} onClose={onClose} title="Your session is paused">
      <form onSubmit={resume}>
        <div className="rounded-lg border border-info/25 bg-info-subtle p-4 text-info"><ShieldCheck aria-hidden size={19} /><p className="mt-3 text-sm font-semibold">Your work is still here.</p><p className="mt-1 text-xs leading-relaxed">Sign in again and return to {SESSION_EXPIRED_PREVIEW.contextLabel}. Nothing was discarded.</p></div>
        <p className="label-caps mt-5">Preview — not wired</p>
        <label htmlFor="resume-email" className="label-caps mt-4 mb-1.5 block">Work email</label>
        <Input id="resume-email" type="email" autoComplete="email" value={SESSION_EXPIRED_PREVIEW.email} readOnly />
        <label htmlFor="resume-password" className="label-caps mt-4 mb-1.5 block">Password</label>
        <Input id="resume-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        <Button type="submit" size="lg" className="mt-5 w-full" loading={busy}>Resume workspace</Button>
        <button type="button" onClick={onClose} className="mt-3 w-full text-center text-xs font-semibold text-fg-muted hover:text-fg">Sign out instead</button>
      </form>
    </Sheet>
  )
}

function ProductPromise() {
  return (
    <section className="relative overflow-hidden rounded-xl border border-border bg-surface/90 p-6 shadow-elev-2 sm:p-8 lg:min-h-[570px] lg:p-10" aria-label="Product introduction">
      <div className="absolute inset-x-0 top-[34%] h-px bg-border" aria-hidden />
      <div className="relative flex h-full flex-col">
        <div className="flex items-center gap-3"><Wordmark size={48} /><div><p className="text-sm font-semibold text-fg">Sales workspace</p><p className="text-2xs text-fg-muted">Every customer promise, accounted for.</p></div></div>
        <div className="my-auto py-10">
          <p className="label-caps text-accent">Clarity from first contact to close</p>
          <h2 className="mt-3 max-w-xl text-3xl font-semibold tracking-[-0.055em] text-fg">Know what needs attention.<br />Know what changes revenue.</h2>
          <p className="mt-4 max-w-lg text-md leading-relaxed text-fg-muted">One calm place for conversations, follow-ups, team decisions and the evidence behind the forecast.</p>
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
          <div className="mb-4 flex w-full items-center gap-3 rounded-xl border border-border bg-surface/90 p-4 shadow-elev-1 lg:hidden"><Wordmark size={42} /><div><p className="text-sm font-semibold text-fg">Sales workspace</p><p className="mt-0.5 text-2xs text-fg-muted">Every customer promise, accounted for.</p></div></div>
          {children}
          <p className="mt-5 flex items-center gap-1.5 text-center text-2xs text-fg-subtle"><ShieldCheck aria-hidden size={12} /> Secure access · Password-manager friendly</p>
        </div>
      </div>
    </main>
  )
}

export function AuthExperiencePreview() {
  const [view, setView] = useState<AuthView>('login')
  const [errorKind, setErrorKind] = useState<AuthFailureKind>('invalid_credentials')
  const [sessionEnded, setSessionEnded] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-canvas shadow-elev-2">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface p-3">
        {(['login', 'invite', 'recovery'] as AuthView[]).map((item) => <button key={item} type="button" onClick={() => setView(item)} aria-pressed={view === item} className={['min-h-9 rounded-md px-3 text-xs font-semibold capitalize', view === item ? 'bg-accent text-accent-fg' : 'text-fg-muted hover:bg-surface-sunk hover:text-fg'].join(' ')}>{item}</button>)}
        <Button className="sm:ml-auto" size="sm" variant="secondary" onClick={() => setSheetOpen(true)}>Preview soft expiry</Button>
      </div>
      <div className="grid min-h-[690px] items-center gap-6 p-4 lg:grid-cols-[minmax(0,1fr)_400px] lg:p-6">
        <div className="hidden h-full lg:block"><ProductPromise /></div>
        <div>
          {view === 'login' && <><LoginCard email="meera@northstar.example" password="••••••••••" error={null} errorKind={errorKind} busy={false} sessionEnded={sessionEnded} onEmail={() => undefined} onPassword={() => undefined} onSubmit={(event) => event.preventDefault()} onForgot={() => setView('recovery')} onInvite={() => setView('invite')} /><div className="mt-3 flex flex-wrap items-center gap-2"><span className="label-caps">Error preview</span>{(['invalid_credentials', 'rate_limited', 'network'] as AuthFailureKind[]).map((kind) => <button key={kind} type="button" onClick={() => setErrorKind(kind)} aria-pressed={errorKind === kind} className={['rounded-pill border px-2.5 py-1 text-2xs font-semibold', errorKind === kind ? 'border-danger/30 bg-danger-subtle text-danger' : 'border-border text-fg-muted'].join(' ')}>{kind.replace('_', ' ')}</button>)}<button type="button" onClick={() => setSessionEnded((value) => !value)} aria-pressed={sessionEnded} className="rounded-pill border border-border px-2.5 py-1 text-2xs font-semibold text-fg-muted">Hard-expiry fallback</button></div></>}
          {view === 'invite' && <InviteFlow onBack={() => setView('login')} />}
          {view === 'recovery' && <RecoveryFlow onBack={() => setView('login')} />}
        </div>
      </div>
      <SessionExpiredPrompt open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </div>
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

  return (
    <AuthShell>
      {view === 'login' && <LoginCard email={email} password={password} error={error} busy={busy} onEmail={setEmail} onPassword={setPassword} onSubmit={submit} onForgot={() => setView('recovery')} onInvite={() => setView('invite')} />}
      {view === 'invite' && <InviteFlow onBack={() => setView('login')} />}
      {view === 'recovery' && <RecoveryFlow onBack={() => setView('login')} />}
    </AuthShell>
  )
}
