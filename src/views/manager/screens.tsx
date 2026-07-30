import { InboxScreen } from '../inbox/InboxScreen'

// SA-03: `Team` is GONE, replaced by the real Floor landing (Joyal's ruling).
// It was a "No team members yet" EmptyState with no data behind it, and the
// rail is better at five real-or-planned doors than six with a third dead one.
export { Floor } from './Floor'

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

// SA-04: `ManagerLeads`, `Assign` and `Analytics` are GONE from this file.
// The Leads board lives on as the CRM Pipeline tab (views/crm/CrmScreen.tsx),
// Analytics is superseded by the Dashboard, and the assignment UI (mock,
// unwired — ROLE-01 still owns the write path) sits on the CRM pipeline.
