import { useState } from 'react'
import { CalendarPlus, CircleAlert, ClipboardList, Clock3 } from 'lucide-react'
import { Button } from '../../ui/Button'
import { SampleTag, StatusBadge } from '../../ui/agent/primitives'
import { MOCK_SLOTS } from '../../lib/mock-wave3'
import { NextAction } from '../../ui/NextAction'

// Site-visit / meeting planner (Wave-3E shape, mock — no calendar wiring).
// Availability → slot → confirmation-message preview → reminder + prep brief.

export function BookingPlanner() {
  const [slot, setSlot] = useState<string | null>(null)
  const [booked, setBooked] = useState(false)

  const chosen = MOCK_SLOTS.find((s) => s.id === slot)

  return (
    <section className="rounded-xl border border-border bg-surface p-4 shadow-elev-1">
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
      <div className="mt-3"><NextAction compact label="Hold Monday at 10:30 am" detail="Matches the family’s stated availability" /></div>

      <div className="mt-4 grid grid-cols-3 gap-2" role="group" aria-label="Visit date preview">
        {[
          ['Mon', '03', '2 free'],
          ['Tue', '04', '4 free'],
          ['Sat', '08', 'Conflict'],
        ].map(([day, date, availability], index) => (
          <button key={day} className={[
            'rounded-lg border px-2 py-2.5 text-center transition-colors',
            index === 0 ? 'border-accent bg-accent-subtle' : index === 2 ? 'border-danger/30 bg-danger-subtle' : 'border-border bg-surface-raised hover:border-border-strong',
          ].join(' ')}>
            <span className="label-caps block">{day}</span>
            <span className="tnum mt-1 block text-lg font-semibold leading-none text-fg">{date}</span>
            <span className={['mt-1 block text-2xs', index === 2 ? 'text-danger' : 'text-fg-muted'].join(' ')}>{availability}</span>
          </button>
        ))}
      </div>

      {!booked ? (
        <>
          <div className="mt-3 space-y-2" role="radiogroup" aria-label="Available slots">
            {MOCK_SLOTS.map((s) => (
              <button
                key={s.id}
                role="radio"
                aria-checked={slot === s.id}
                disabled={!s.free}
                onClick={() => setSlot(s.id)}
                className={[
                  'flex min-h-12 w-full items-center justify-between gap-3 rounded-lg border px-3 text-left text-xs transition-colors',
                  !s.free
                    ? 'cursor-not-allowed border-danger/25 bg-danger-subtle text-danger'
                    : slot === s.id
                      ? 'border-accent bg-accent-subtle text-fg'
                      : 'border-border bg-surface text-fg hover:border-border-strong',
                ].join(' ')}
              >
                <span className="flex items-center gap-2"><Clock3 aria-hidden size={14} /><span className="tnum font-medium">{s.label}</span></span>
                <span className="text-fg-muted">{s.free ? s.who : <span className="flex items-center gap-1 text-danger"><CircleAlert aria-hidden size={12} /> Counsellor conflict</span>}</span>
              </button>
            ))}
          </div>

          {chosen && (
            <div className="mt-3 rounded-lg border border-border bg-surface-sunk px-3 py-3">
              <p className="label-caps mb-1">Confirmation message preview</p>
              <p className="text-xs text-fg">
                “Hi Anjali! Your campus visit is confirmed for {chosen.label.toLowerCase()} with{' '}
                {chosen.who.split(' ')[0]}. Reply here if you need to change it.”
              </p>
            </div>
          )}

          <div className="mt-3 flex gap-2">
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
        <div className="mt-3 space-y-3">
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
