import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { BookingRow } from '../../lib/crm-data'

// REG-010. Two separate columns — booking status and payment status — were
// rendered as two bare words side by side, so a row read "confirmed pending"
// and looked self-contradictory. The dates were raw ISO strings.
// The SEED-* rows are demo DATA, not a code defect: no filter here, because one
// would hide real rows in production.
const { useBookings } = vi.hoisted(() => ({ useBookings: vi.fn() }))
vi.mock('../../lib/crm-data', () => ({ useBookings }))
vi.mock('../../shell/ClientProvider', () => ({ useClient: () => ({ activeClient: { id: 'c-1' } }) }))

const { BookingsTab } = await import('./BookingsTab')

function booking(over: Partial<BookingRow> = {}): BookingRow {
  return {
    id: 'b-1',
    booking_ref: 'SEED-001',
    customer_name: 'Anjali Rao',
    checkin_date: '2026-09-14T00:00:00.000Z',
    checkout_date: '2026-09-16T00:00:00.000Z',
    start_date: null,
    end_date: null,
    slot_time: null,
    guests: 2,
    party_size: null,
    total_price: 25000,
    status: 'confirmed',
    payment_status: 'pending',
    ...over,
  } as BookingRow
}

function renderTab(rows: BookingRow[]) {
  useBookings.mockReturnValue({ items: rows, loading: false, error: null })
  return render(<BookingsTab />)
}

describe('BookingsTab', () => {
  // The month abbreviation is ICU-dependent ("Sep" vs "Sept"), so assert the
  // shape rather than one runtime's exact string.
  it('formats the stay window instead of printing raw ISO timestamps', () => {
    renderTab([booking()])
    expect(screen.queryByText(/T00:00:00/)).not.toBeInTheDocument()
    expect(screen.getAllByText(/^14 \w+ 2026 → 16 \w+ 2026$/).length).toBeGreaterThan(0)
  })

  it('labels each status so confirmed and pending stop reading as a contradiction', () => {
    renderTab([booking()])
    expect(screen.getByText('Booking confirmed')).toBeInTheDocument()
    expect(screen.getByText('Payment pending')).toBeInTheDocument()
  })

  it('keeps demo rows visible — a seed filter would hide real rows too', () => {
    renderTab([booking({ booking_ref: 'SEED-001' })])
    expect(screen.getByText('SEED-001')).toBeInTheDocument()
  })

  it('says a booking has no date rather than printing "dateless"', () => {
    renderTab([booking({ checkin_date: null, checkout_date: null })])
    expect(screen.getAllByText('No date set').length).toBeGreaterThan(0)
  })

  it('passes a non-date value straight through rather than guessing', () => {
    renderTab([booking({ checkin_date: 'sometime in autumn', checkout_date: null })])
    expect(screen.getAllByText('sometime in autumn').length).toBeGreaterThan(0)
  })
})
