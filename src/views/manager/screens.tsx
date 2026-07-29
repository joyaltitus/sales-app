import { EmptyState } from '../../ui/EmptyState'
import { InboxScreen } from '../inbox/InboxScreen'

// Manager view stubs (SA-00 scaffold). Team/Assign/Analytics fill in with
// ROLE-01 (assigned_to write-scope) + the insights epic.
function Screen({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <section className="p-6">
      <h1 className="mb-4 text-xl font-semibold text-fg">{title}</h1>
      {children}
    </section>
  )
}

export function Team() {
  return (
    <Screen title="Team">
      <EmptyState title="No team members yet" body="Reps you manage appear here." />
    </Screen>
  )
}

// Same Inbox, same reads, same RLS. `manager` is NOT in hub-service's
// TENANT_ROLES (src/api/auth.ts:13), so a manager's send would return 403 —
// the composer renders read-only rather than as a dead button. Widening that
// role list is an authorization change and belongs to its own src/api/ session
// with an auth review (Joyal's ruling, SA-01b).
export function ManagerInbox() {
  return <InboxScreen canSend={false} />
}

export function Assign() {
  return (
    <Screen title="Assign">
      <EmptyState
        title="Nothing to assign"
        body="Unassigned conversations will queue here (lands with ROLE-01)."
      />
    </Screen>
  )
}

export function Analytics() {
  return (
    <Screen title="Analytics">
      <EmptyState title="No data yet" body="Per-rep numbers appear once conversations flow." />
    </Screen>
  )
}
