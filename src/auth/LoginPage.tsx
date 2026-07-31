import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'

// UI-DESIGN-01 login — the first impression (audit A1). Composition: the
// handover-seam motif runs full-bleed behind a raised auth card that breaks
// it; a neutral geometric mark carries identity WITHOUT a name (working-name
// law: never invent a brand). Presentation is exported for the /preview
// gallery; the page owns the (pre-existing) auth call.

/** The mark: a rounded square the seam passes through — the product's one
 *  signature drawn as a glyph. Neutral, nameless, zero bytes. */
export function Wordmark({ size = 40 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-border-strong bg-surface-raised shadow-elev-1"
      style={{ width: size, height: size }}
    >
      <span className="absolute inset-x-0 h-px bg-border-strong" />
      <span className="absolute h-px w-1/2 bg-accent" style={{ left: '25%' }} />
    </span>
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
}: {
  email: string
  password: string
  error: string | null
  busy: boolean
  onEmail: (v: string) => void
  onPassword: (v: string) => void
  onSubmit: (e: React.FormEvent) => void
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="relative w-full max-w-sm rounded-md border border-border bg-surface p-7 shadow-elev-2"
    >
      <div className="mb-6 flex items-center gap-3">
        <Wordmark />
        <div>
          <h1 className="text-md leading-tight font-semibold text-fg">Sign in</h1>
          <p className="text-xs text-fg-muted">Use your team login.</p>
        </div>
      </div>

      <label htmlFor="login-email" className="label-caps mb-1 block">Email</label>
      <Input
        id="login-email"
        type="email"
        autoComplete="email"
        autoFocus
        value={email}
        onChange={(e) => onEmail(e.target.value)}
        required
        className="mb-3"
      />

      <label htmlFor="login-password" className="label-caps mb-1 block">Password</label>
      <Input
        id="login-password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => onPassword(e.target.value)}
        required
        className="mb-4"
      />

      {error && (
        <p
          className="mb-3 rounded-sm border border-danger/40 bg-danger-subtle px-3 py-2 text-xs text-danger"
          role="alert"
        >
          {error}
        </p>
      )}

      <Button type="submit" loading={busy} className="w-full">
        Sign in
      </Button>
    </form>
  )
}

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Password entry is the user's own — never stored, never logged (unchanged).
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setBusy(false)
  }

  return (
    <main className="relative flex min-h-full flex-col items-center justify-center bg-canvas px-4 py-10">
      {/* The seam, full-bleed behind the card — the one signature (§1.3),
          arriving before the first sign-in. */}
      <span aria-hidden className="absolute inset-x-0 top-[38%] h-px bg-border" />

      <LoginCard
        email={email}
        password={password}
        error={error}
        busy={busy}
        onEmail={setEmail}
        onPassword={setPassword}
        onSubmit={submit}
      />

      {/* What this is, without a name (working-name law). */}
      <p className="label-caps mt-6 text-fg-subtle">WhatsApp · Instagram · AI assisted</p>
    </main>
  )
}
