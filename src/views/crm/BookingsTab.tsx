import { useClient } from '../../shell/ClientProvider'
import { useBookings } from '../../lib/crm-data'
import type { BookingRow } from '../../lib/crm-data'
import { Chip } from '../../ui/Chip'
import { EmptyState } from '../../ui/EmptyState'

// Bookings — REAL as of SA-05 (crm-data.useBookings: the `bookings` read
// Workbench already issues browser-side under RLS). Read-only ledger: ref,
// customer, when, guests, total, status, payment.

const monoStyle = { fontFamily: 'var(--font-mono)' } as const

function when(b: BookingRow): string {
  const start = b.checkin_date ?? b.start_date
  const end = b.checkout_date ?? b.end_date
  if (b.slot_time) return `${start ?? '—'} · ${b.slot_time}`
  if (start && end) return `${start} → ${end}`
  return start ?? 'dateless'
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
            <span className="flex shrink-0 items-center gap-1.5">
              <Chip tone={statusTone(b.status)}>{b.status ?? 'pending'}</Chip>
              <Chip tone={b.payment_status === 'paid' ? 'success' : 'warn'}>
                {b.payment_status ?? 'pending'}
              </Chip>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
