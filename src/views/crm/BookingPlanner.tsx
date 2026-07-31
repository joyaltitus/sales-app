import { useState } from 'react'
import { CalendarPlus, ClipboardList } from 'lucide-react'
import { Button } from '../../ui/Button'
import { SampleTag, StatusBadge } from '../../ui/agent/primitives'
import { MOCK_SLOTS } from '../../lib/mock-wave3'

// Site-visit / meeting planner (Wave-3E shape, mock — no calendar wiring).
// Availability → slot → confirmation-message preview → reminder + prep brief.

export function BookingPlanner() {
  const [slot, setSlot] = useState<string | null>(null)
  const [booked, setBooked] = useState(false)

  const chosen = MOCK_SLOTS.find((s) => s.id === slot)

  return (
    <section className="rounded-md border border-border bg-surface p-3.5 shadow-elev-1">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-fg">
          <CalendarPlus aria-hidden size={15} className="text-accent" />
          Book a campus visit
        </h3>
        <SampleTag label="Preview — not wired" />
      </div>
      <p className="mt-0.5 text-2xs text-fg-muted">
        Anjali Ramesh · counsellor availability, next 3 days
      </p>

      {!booked ? (
        <>
          <div className="mt-2.5 space-y-1.5" role="radiogroup" aria-label="Available slots">
            {MOCK_SLOTS.map((s) => (
              <button
                key={s.id}
                role="radio"
                aria-checked={slot === s.id}
                disabled={!s.free}
                onClick={() => setSlot(s.id)}
                className={[
                  'flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-xs transition-colors',
                  !s.free
                    ? 'cursor-not-allowed border-border bg-surface-sunk text-fg-subtle line-through'
                    : slot === s.id
                      ? 'border-accent bg-accent-subtle text-fg'
                      : 'border-border bg-surface text-fg hover:border-border-strong',
                ].join(' ')}
              >
                <span className="tnum font-medium">{s.label}</span>
                <span className="text-fg-muted">{s.who}</span>
              </button>
            ))}
          </div>

          {chosen && (
            <div className="mt-2.5 rounded-sm border border-border bg-surface-sunk px-2.5 py-2">
              <p className="label-caps mb-1">Confirmation message preview</p>
              <p className="text-xs text-fg">
                “Hi Anjali! Your campus visit is confirmed for {chosen.label.toLowerCase()} with{' '}
                {chosen.who.split(' ')[0]}. Reply here if you need to change it.”
              </p>
            </div>
          )}

          <div className="mt-2.5 flex gap-2">
            <Button size="sm" disabled={!chosen} onClick={() => setBooked(true)}>
              Book & queue confirmation
            </Button>
            {chosen && (
              <Button size="sm" variant="ghost" onClick={() => setSlot(null)}>
                Clear
              </Button>
            )}
          </div>
        </>
      ) : (
        <div className="mt-2.5 space-y-2">
          <StatusBadge tone="success">Booked · {chosen?.label}</StatusBadge>
          <p className="text-2xs text-fg-muted">
            Reminder set for 1 hour before. Reschedule or cancel from this card.
          </p>
          <div className="rounded-sm border border-border bg-surface-sunk px-2.5 py-2">
            <p className="label-caps mb-1 flex items-center gap-1">
              <ClipboardList aria-hidden size={11} />
              Pre-visit brief
            </p>
            <ul className="list-inside list-disc text-2xs text-fg-muted">
              <li>Wants: NEET repeater, evening only</li>
              <li>Budget ₹60,000 — two instalments matter</li>
              <li>Objection: travel from Aluva (mention hostel option)</li>
            </ul>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setBooked(false)}>
              Reschedule
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setBooked(false); setSlot(null) }}>
              Cancel visit
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
