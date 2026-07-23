import { EmptyState } from '../../ui/EmptyState'

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

export function ManagerInbox() {
  return (
    <Screen title="Inbox">
      <EmptyState title="No conversations" body="All team conversations show here." />
    </Screen>
  )
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
