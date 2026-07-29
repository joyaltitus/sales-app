import { InboxScreen } from '../inbox/InboxScreen'
import { Health } from './Health'

// Admin mounts of the two existing screens — same file shape as
// views/manager/screens.tsx. Both are the SAME implementation the rep and
// manager get; there is no admin fork of either.
export { Health }

// `client_admin` is already in hub-service's TENANT_ROLES
// (src/api/auth.ts:26), alongside agent, manager and super_admin — so an admin
// replying goes through exactly the same gateway path a rep's reply does, and
// needed no hub-service change in SA-03.
//
// ⚠ canSend is a RENDERING decision, as it is everywhere else in this app. It
// grants nothing: hub-service re-derives authority from the JWT and
// user_client_memberships on every request.
export function AdminInbox() {
  return <InboxScreen canSend />
}

// SA-04: `AdminLeads` is GONE — the board lives on as the CRM Pipeline tab
// (views/crm/CrmScreen.tsx), same reads, same RLS, same `leads_write` policy
// facts (migration 035).
