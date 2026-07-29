import { useMockBookings } from '../../lib/mock-data'
import type { MockBooking } from '../../lib/mock-data'
import { Chip } from '../../ui/Chip'
import { SampleBanner } from './CrmScreen'

// Bookings — SAMPLE DATA (lib/mock-data.ts). Read-only ledger, matching the
// Workbench Bookings tab's columns: ref, customer, when, guests, total,
// status, payment. The wiring session swaps the hook for a `bookings` read.

const capsStyle = {
  fontWeight: 'var(--weight-caps)',
  letterSpacing: 'var(--tracking-caps)',
} as const

const monoStyle = { fontFamily: 'var(--font-mono)' } as const

function when(b: MockBooking): string {
  if (b.slot_time) return `${b.checkin_date ?? '—'} · ${b.slot_time}`
  if (b.checkin_date && b.checkout_date) return `${b.checkin_date} → ${b.checkout_date}`
  return b.checkin_date ?? 'dateless'
}

const STATUS_TONE: Record<MockBooking['status'], 'success' | 'warn' | 'danger'> = {
  confirmed: 'success',
  pending: 'warn',
  cancelled: 'danger',
}

export function BookingsTab() {
  const { items } = useMockBookings()

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SampleBanner>Sample data — bookings wiring lands in a follow-up session</SampleBanner>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {items.map((b) => (
          <div
            key={b.id}
            className="flex items-center gap-3 border-b border-border bg-surface px-4 py-3"
          >
            <span className="tnum shrink-0 text-sm font-semibold text-fg" style={monoStyle}>
              {b.booking_ref}
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
                {b.guests != null && (
                  <span className="text-2xs text-fg-subtle uppercase" style={capsStyle}>
                    {b.guests} guests
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
              <Chip tone={STATUS_TONE[b.status]}>{b.status}</Chip>
              <Chip tone={b.payment_status === 'paid' ? 'success' : 'warn'}>
                {b.payment_status}
              </Chip>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
