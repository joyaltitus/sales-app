import { useClient } from './ClientProvider'
import { HandoffScreen } from './HandoffScreen'
import { RepShell } from './RepShell'
import { ManagerShell } from './ManagerShell'
import { AdminShell } from './AdminShell'
import { EmptyState } from '../ui/EmptyState'
import { Skeleton } from '../ui/Skeleton'

// Role → view auto-route (MASTER-PLAN §A).
//   agent        → rep shell (phone-first, bottom tabs)
//   manager      → manager shell (desktop-first, left rail)
//   client_admin → admin shell (desktop-first, left rail)   ← SA-03
//   super_admin  → Workbench handoff
//
// ⚠ THREE SHELLS, NOT FOUR (Joyal's ruling 2026-07-29). `super_admin` KEEPS the
// Workbench punt below; only `client_admin` gained a shell. The split of what
// used to be one fallthrough case is the whole of SA-03's role change, and
// every branch in the switch is covered by RoleRouter.test.tsx — including the
// super_admin one, as a regression guard rather than a new feature.
//
// ⚠ ROLE-WALL NOTE (§2): this switch decides what is PAINTED and nothing else.
// `activeClient.role` comes from user_client_memberships under RLS; forcing it
// client-side changes the rendered shell and grants no data and no API
// capability. RLS governs every read, and hub-service re-derives authority from
// the JWT on every request. AdminShell.wall.test.tsx asserts that empirically
// rather than trusting this comment.
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

  switch (activeClient.role) {
    case 'agent':
      return <RepShell />
    case 'manager':
      return <ManagerShell />
    case 'client_admin':
      return <AdminShell />
    case 'super_admin':
      return <HandoffScreen role={activeClient.role} />
    default:
      return (
        <div className="flex min-h-full items-center justify-center p-6">
          <EmptyState title="Unknown role" body={`Role "${activeClient.role}" has no view.`} />
        </div>
      )
  }
}
