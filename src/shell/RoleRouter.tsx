import { useClient } from './ClientProvider'
import { HandoffScreen } from './HandoffScreen'
import { RepShell } from './RepShell'
import { ManagerShell } from './ManagerShell'
import { EmptyState } from '../ui/EmptyState'
import { Skeleton } from '../ui/Skeleton'

// Role → view auto-route (MASTER-PLAN §A). Coded for all 4 roles now; the live
// manager login + assigned_to RLS scope land with ROLE-01 (deferred acceptance).
//   agent        → rep shell (phone-first, bottom tabs)
//   manager      → manager shell (desktop-first, left rail)
//   client_admin → Workbench handoff
//   super_admin  → Workbench handoff
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
