import { useCallback } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useClient } from './ClientProvider'
import type { Role } from './ClientProvider'
import { HandoffScreen } from './HandoffScreen'
import { RepShell } from './RepShell'
import { ManagerShell } from './ManagerShell'
import { AdminShell } from './AdminShell'
import { useAuth } from '../auth/AuthProvider'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { ErrorState } from '../ui/ErrorState'
import { Skeleton } from '../ui/Skeleton'

// Role → view auto-route (MASTER-PLAN §A).
//   agent        → rep shell (phone-first, bottom tabs)     at /rep
//   manager      → manager shell (desktop-first, left rail) at /manage
//   client_admin → admin shell (desktop-first, left rail)   at /admin   ← SA-03
//   super_admin  → Workbench handoff
//
// ⚠ THREE SHELLS, NOT FOUR (Joyal's ruling 2026-07-29). `super_admin` KEEPS the
// Workbench punt below; only `client_admin` gained a shell. The split of what
// used to be one fallthrough case is the whole of SA-03's role change, and
// every branch is covered by RoleRouter.test.tsx — including the super_admin
// one, as a regression guard rather than a new feature.
//
// ⚠ ROLE-WALL NOTE (§2): this file decides what is PAINTED and nothing else.
// `activeClient.role` comes from user_client_memberships under RLS; forcing it
// client-side changes the rendered shell and grants no data and no API
// capability. RLS governs every read, and hub-service re-derives authority from
// the JWT on every request. AdminShell.wall.test.tsx asserts that empirically
// rather than trusting this comment. AT-26 gives each shell its own URL so the
// three roles can be linked and screenshotted separately — a URL is an address,
// never a permission: visiting /admin as a rep redirects, and would gain
// nothing from the server even if it did not.
export const ROLE_HOME: Record<Exclude<Role, 'super_admin'>, string> = {
  client_admin: '/admin',
  manager: '/manage',
  agent: '/rep',
}

/**
 * The same screen is mounted at different segments in different shells: the
 * rep's CRM lives at `leads`, the manager's and admin's at `crm`. ManagerShell
 * and AdminShell already redirect `leads` -> `crm` inside their own route
 * tables, so only the rep needs a translation — and it needs one, because
 * RepShell has no `crm` route at all and `/rep/crm` falls through to `*`.
 */
const PATH_ALIAS: Partial<Record<Exclude<Role, 'super_admin'>, Record<string, string>>> = {
  agent: { '/crm': '/leads' },
}

/**
 * Prefix an in-app path with the shell the caller is actually mounted in.
 *
 * Every shared CTA used to build a root-absolute URL — `/inbox`, `/crm`,
 * `/dashboard`. None of those are routes: the shells mount at `admin/*`,
 * `manage/*` and `rep/*`, so each one fell through to `<Route path="*">` and
 * silently redirected the user to their own home instead of the screen they
 * asked for.
 *
 * Relative links are NOT an alternative. Each shell owns a nested bare
 * `<Routes>`, so from `/rep/leads` a relative `to="inbox"` resolves to
 * `/rep/leads/inbox`, which is a different wrong answer.
 */
export function useRolePath(): (to: string) => string {
  const { activeClient } = useClient()
  const role = activeClient?.role as Exclude<Role, 'super_admin'> | undefined
  const base = role ? ROLE_HOME[role] : undefined
  const alias = role ? PATH_ALIAS[role] : undefined

  return useCallback(
    (to: string) => {
      // Leave anything that is not an app-absolute path alone: an external URL,
      // an anchor, or a path already carrying its shell base.
      if (!base || !to.startsWith('/')) return to
      if (to === base || to.startsWith(`${base}/`) || to.startsWith(`${base}?`)) return to
      const cut = to.search(/[?#]/)
      const path = cut === -1 ? to : to.slice(0, cut)
      const rest = cut === -1 ? '' : to.slice(cut)
      const resolved = alias?.[path] ?? path
      return resolved === '/' ? base + rest : base + resolved + rest
    },
    [base, alias],
  )
}

export function RoleRouter() {
  const { activeClient, loading, failure, reload } = useClient()
  const { signOut } = useAuth()

  if (loading) {
    return (
      <div className="mx-auto max-w-md space-y-3 p-6">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  // An expired token and a login with no team both arrive here as an empty
  // client list. Saying "no workspace" to the first sends an operator to their
  // admin over a problem only they can fix, which is why the provider now
  // distinguishes them (REG-031).
  if (failure === 'expired') {
    return (
      <div className="flex min-h-full items-center justify-center p-6">
        <EmptyState
          title="Your session expired"
          body="You were signed out for security. Sign in again to pick up where you left off."
          action={<Button onClick={() => void signOut()}>Sign in again</Button>}
        />
      </div>
    )
  }

  if (failure === 'failed') {
    return (
      <div className="flex min-h-full items-center justify-center p-6">
        <ErrorState
          title="Couldn't load your workspaces."
          body="The workspace list didn't come back. Check your connection and try again."
          onRetry={reload}
        />
      </div>
    )
  }

  if (!activeClient) {
    return (
      <div className="flex min-h-full items-center justify-center p-6">
        <EmptyState
          title="No workspace yet"
          body="Your login isn't attached to a team. Ask your admin to add you."
        />
      </div>
    )
  }

  // super_admin never reaches a shell route: the punt is the whole branch.
  if (activeClient.role === 'super_admin') {
    return <HandoffScreen role={activeClient.role} />
  }

  const home = ROLE_HOME[activeClient.role as Exclude<Role, 'super_admin'>]
  if (!home) {
    return (
      <div className="flex min-h-full items-center justify-center p-6">
        <EmptyState title="Unknown role" body={`Role "${activeClient.role}" has no view.`} />
      </div>
    )
  }

  // Paths are relative: App.tsx mounts this under `/*`, so a leading slash here
  // would be an invalid nested absolute path. `<Navigate to>` stays absolute.
  //
  // Each route renders its shell only for the role that owns it; every other
  // role — and every unknown path, including "/" straight after login — lands
  // on the caller's own home. That is the redirect AT-26 asks for, and it is
  // also why there is no 404 branch: a signed-in user always has exactly one
  // home to be sent to.
  return (
    <Routes>
      <Route
        path="admin/*"
        element={home === '/admin' ? <AdminShell /> : <Navigate to={home} replace />}
      />
      <Route
        path="manage/*"
        element={home === '/manage' ? <ManagerShell /> : <Navigate to={home} replace />}
      />
      <Route
        path="rep/*"
        element={home === '/rep' ? <RepShell /> : <Navigate to={home} replace />}
      />
      <Route path="*" element={<Navigate to={home} replace />} />
    </Routes>
  )
}
