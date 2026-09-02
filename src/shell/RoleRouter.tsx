import { Navigate, Route, Routes } from 'react-router-dom'
import { useClient } from './ClientProvider'
import type { Role } from './ClientProvider'
import { HandoffScreen } from './HandoffScreen'
import { RepShell } from './RepShell'
import { ManagerShell } from './ManagerShell'
import { AdminShell } from './AdminShell'
import { EmptyState } from '../ui/EmptyState'
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

export function RoleRouter() {
  const { activeClient, loading } = useClient()

  if (loading) {
    return (
      <div className="mx-auto max-w-md space-y-3 p-6">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
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
