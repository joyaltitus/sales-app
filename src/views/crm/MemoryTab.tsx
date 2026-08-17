import { Link2 } from 'lucide-react'
import { FactCard } from '../../ui/agent/FactCard'
import { Skeleton } from '../../ui/Skeleton'
import { ErrorState } from '../../ui/ErrorState'
import { useLeadMemory } from '../../lib/crm-data'
import type { LeadItem } from '../../lib/leads-data'

// Lead Brain — full Memory view inside the lead drawer.
// Everything the machine believes about this customer, grouped by state:
// suggested first (needs a human), then confirmed ground truth.

export function MemoryTab({
  clientId,
  lead,
}: {
  clientId?: string
  lead?: LeadItem | null
}) {
  const { facts, loading, error, reload } = useLeadMemory(
    clientId ?? null,
    lead?.contact_id ?? null,
    lead?.conversation_id ?? null,
  )

  const suggested = facts.filter((f) => f.state === 'suggested')
  const rest = facts.filter((f) => f.state !== 'suggested')

  if (loading) {
    return (
      <div className="space-y-2 p-2">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  if (error) {
    return <ErrorState title="Couldn't load customer memory" body={error} onRetry={() => void reload()} />
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-fg-muted">
          What the assistant has learned from this customer's own messages.
        </p>
      </div>

      {facts.length === 0 ? (
        <p className="py-6 text-center text-xs text-fg-subtle">
          No customer facts extracted yet.
        </p>
      ) : (
        <>
          {/* Cross-channel continuity */}
          <p className="flex items-center gap-1.5 rounded-md border border-border bg-surface-sunk px-2.5 py-1.5 text-2xs text-fg-muted">
            <Link2 aria-hidden size={12} className="shrink-0" />
            Memory is continuous across all channels for this contact.
          </p>

          {suggested.length > 0 && (
            <section>
              <h3 className="label-caps mb-2">Waiting for your confirmation</h3>
              <div className="space-y-2">
                {suggested.map((f) => (
                  <FactCard key={f.id} fact={f} />
                ))}
              </div>
            </section>
          )}

          {rest.length > 0 && (
            <section>
              <h3 className="label-caps mb-2">Confirmed memory</h3>
              <div className="space-y-2">
                {rest.map((f) => (
                  <FactCard key={f.id} fact={f} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
