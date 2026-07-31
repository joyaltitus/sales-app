import { Link2 } from 'lucide-react'
import { FactCard } from '../../ui/agent/FactCard'
import { SampleTag } from '../../ui/agent/primitives'
import { MOCK_FACTS } from '../../lib/mock-wave3'

// Lead Brain — full Memory view inside the lead drawer (A-UI shape, mock).
// Everything the machine believes about this customer, grouped by state:
// suggested first (needs a human), then confirmed ground truth.

export function MemoryTab() {
  const suggested = MOCK_FACTS.filter((f) => f.state === 'suggested')
  const rest = MOCK_FACTS.filter((f) => f.state !== 'suggested')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-fg-muted">
          What the assistant has learned from this customer's own messages.
        </p>
        <SampleTag label="Preview — not wired" />
      </div>

      {/* Cross-channel continuity */}
      <p className="flex items-center gap-1.5 rounded-md border border-border bg-surface-sunk px-2.5 py-1.5 text-2xs text-fg-muted">
        <Link2 aria-hidden size={12} className="shrink-0" />
        Same person on WhatsApp and Instagram — memory is shared across both threads.
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

      <section>
        <h3 className="label-caps mb-2">Confirmed memory</h3>
        <div className="space-y-2">
          {rest.map((f) => (
            <FactCard key={f.id} fact={f} />
          ))}
        </div>
      </section>
    </div>
  )
}
