import { Link } from 'react-router-dom'
import { EmptyState } from '../../ui/EmptyState'
import { Button } from '../../ui/Button'
import { InboxScreen } from '../inbox/InboxScreen'
import { LeadsScreen } from '../leads/LeadsScreen'

// Rep view stubs (SA-00 scaffold). Real screens land in the ONB/FLW/inbox epics.
function Screen({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <section className="p-4">
      <h1 className="mb-4 text-lg font-semibold text-fg">{title}</h1>
      {children}
    </section>
  )
}

// The rep's landing is real as of SA-03 — it was a "Nothing due yet"
// placeholder through SA-00..SA-02.
export { Today } from './Today'

// The rep is `agent`, which IS in hub-service's TENANT_ROLES — reps can send.
export function RepInbox() {
  return <InboxScreen canSend />
}

export function Leads() {
  return <LeadsScreen />
}

// "More" holds the labeled doors (Joyal's doors model). A door whose flag is
// off is not rendered — proven here by the flag-gated Product-AI door.
export function More({ productAi }: { productAi: boolean }) {
  return (
    <Screen title="More">
      <div className="divide-y divide-border overflow-hidden rounded-md border border-border bg-surface">
        <Door label="Objections" to="#" />
        <Door label="Fees" to="#" />
        {productAi ? (
          <Door label="Product AI" to="/more/product-ai" />
        ) : (
          <div className="px-4 py-3 text-xs text-fg-subtle">
            Product AI — off for this workspace
          </div>
        )}
      </div>
    </Screen>
  )
}

function Door({ label, to }: { label: string; to: string }) {
  return (
    <Link
      to={to}
      className="block px-4 py-3 text-sm text-fg hover:bg-surface-sunk"
    >
      {label}
    </Link>
  )
}

export function ProductAiDoor() {
  return (
    <Screen title="Product AI">
      <EmptyState
        title="Ask about a product"
        body="Answers come from your product knowledge base."
        action={<Button variant="secondary" size="sm">Coming soon</Button>}
      />
    </Screen>
  )
}
