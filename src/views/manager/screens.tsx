import { EmptyState } from '../../ui/EmptyState'
import { InboxScreen } from '../inbox/InboxScreen'
import { LeadsScreen } from '../leads/LeadsScreen'

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

// Same Inbox, same reads, same RLS, and — since SA-01c — the same composer.
// `manager` joined hub-service's TENANT_ROLES (src/api/auth.ts), so a manager
// supervising a floor can answer a customer exactly as a rep can. SA-01b had
// shipped this read-only because that grant did not exist yet.
//
// REQUIRES hub-service >= the SA-01c deploy. Against an older hub-service this
// composer renders but every send returns 403 'forbidden', which the Composer
// surfaces as "You don't have permission to reply on this conversation."
export function ManagerInbox() {
  return <InboxScreen canSend />
}

// Same Leads board, same reads, same RLS. Manager rows are all editable
// (`leads_write` covers client_admin/manager unconditionally) — rep rows are
// scoped per-conversation-assignment (see LeadsScreen's ROLE-WALL note).
export function ManagerLeads() {
  return <LeadsScreen />
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
