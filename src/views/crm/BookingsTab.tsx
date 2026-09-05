import { useClient } from '../../shell/ClientProvider'
import { useBookings } from '../../lib/crm-data'
import type { BookingRow } from '../../lib/crm-data'
import { Chip } from '../../ui/Chip'
import { EmptyState } from '../../ui/EmptyState'

// Bookings — REAL as of SA-05 (crm-data.useBookings: the `bookings` read
// Workbench already issues browser-side under RLS). Read-only ledger: ref,
// customer, when, guests, total, status, payment.

const monoStyle = { fontFamily: 'var(--font-mono)' } as const

/** These columns arrive as raw ISO strings and were rendered verbatim, so a row
 *  read `2026-09-14T00:00:00.000Z → 2026-09-16T00:00:00.000Z`. Formatted the
 *  way FollowUpsTab formats its own dates. A value that is not a date is left
 *  exactly as it came rather than being guessed at.
 *  Locale and time zone are PINNED: these are date-only columns stored as
 *  `T00:00:00.000Z`, so the system zone would render 14 Sep as 13 Sep for any
 *  user west of UTC, and the system locale would reorder the parts per machine
 *  (CI runs en-US). `TargetsPage` pins UTC for the same reason. */
function day(value: string | null | undefined): string | null {
  if (!value) return null
  const at = new Date(value)
  return Number.isNaN(at.getTime())
    ? value
    : at.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

function when(b: BookingRow): string {
  const start = day(b.checkin_date ?? b.start_date)
  const end = day(b.checkout_date ?? b.end_date)
  if (b.slot_time) return `${start ?? '—'} · ${b.slot_time}`
  if (start && end) return `${start} → ${end}`
  return start ?? 'No date set'
}

function statusTone(status: string | null): 'success' | 'warn' | 'danger' {
  if (status === 'confirmed') return 'success'
  if (status === 'cancelled') return 'danger'
  return 'warn'
}

export function BookingsTab() {
  const { activeClient } = useClient()
  const { items, loading } = useBookings(activeClient?.id ?? null)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {!loading && items.length === 0 && (
        <div className="p-6">
          <EmptyState
            title="No bookings yet."
            body="Confirmed bookings from conversations appear here."
          />
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {items.map((b) => (
          <div
            key={b.id}
            className="flex items-center gap-3 border-b border-border bg-surface px-4 py-3"
          >
            <span className="tnum shrink-0 text-sm font-semibold text-fg" style={monoStyle}>
              {b.booking_ref ?? '—'}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="truncate text-sm text-fg">{b.customer_name ?? 'Unknown'}</span>
                <span className="tnum hidden shrink-0 text-xs text-fg-subtle sm:inline" style={monoStyle}>
                  {when(b)}
                </span>
              </div>
              <div className="mt-0.5 flex items-center gap-3">
                <span className="tnum text-xs text-fg-subtle sm:hidden" style={monoStyle}>
                  {when(b)}
                </span>
                {(b.guests ?? b.party_size) != null && (
                  <span className="text-2xs text-fg-subtle">
                    {b.guests ?? b.party_size} guests
                  </span>
                )}
              </div>
            </div>
            {b.total_price != null && (
              <span className="tnum shrink-0 text-sm text-fg" style={monoStyle}>
                ₹{b.total_price.toLocaleString('en-IN')}
              </span>
            )}
            {/* Two independent columns rendered as two bare words put
                "confirmed" and "pending" side by side on one row, which reads as
                a contradiction rather than as booking-state plus payment-state.
                Each chip now says which question it answers. */}
            <span className="flex shrink-0 items-center gap-1.5">
              <Chip tone={statusTone(b.status)}>Booking {b.status ?? 'pending'}</Chip>
              <Chip tone={b.payment_status === 'paid' ? 'success' : 'warn'}>
                Payment {b.payment_status ?? 'pending'}
              </Chip>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
