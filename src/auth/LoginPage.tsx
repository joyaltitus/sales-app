import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'

// Email/password sign-in. Password entry is the user's own — never stored,
// never logged. Auth state flows through AuthProvider on success.
export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setBusy(false)
  }

  return (
    <main className="flex min-h-full items-center justify-center bg-canvas px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-md border border-border bg-surface p-6"
      >
        <h1 className="mb-1 text-lg font-semibold text-fg">Sign in</h1>
        <p className="mb-5 text-xs text-fg-muted">Use your team login.</p>

        <label htmlFor="login-email" className="label-caps mb-1 block">Email</label>
        <Input
          id="login-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="mb-3"
        />

        <label htmlFor="login-password" className="label-caps mb-1 block">Password</label>
        <Input
          id="login-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="mb-4"
        />

        {error && (
          <p className="mb-3 text-xs text-danger" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" loading={busy} className="w-full">
          Sign in
        </Button>
      </form>
    </main>
  )
}
