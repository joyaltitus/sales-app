import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { QueueRow } from './QueueRow'
import type { QueueItem } from '../../lib/inbox-data'

const baseItem: QueueItem = {
  id: 'conv-101',
  contact_id: 'contact-101',
  status: 'open',
  bot_paused: false,
  unread_count: 0,
  last_customer_message_at: '2026-08-10T10:00:00Z',
  last_bot_message_at: null,
  escalation_resolved: false,
  assigned_to: null,
  rolling_summary: null,
  summary_upto: null,
  contact: {
    profile_name: 'Anjali Ramesh',
    channel: 'whatsapp',
    external_id: '+91 98470 12345',
    profile: null,
    is_opted_out: false,
  },
}

describe('QueueRow WhatsApp-like unread treatment', () => {
  it('renders high-contrast solid badge when unread_count > 0', () => {
    const item = { ...baseItem, unread_count: 3 }
    render(<QueueRow item={item} preview="Fee structure enquiry" selected={false} onSelect={vi.fn()} />)

    const badge = screen.getByText('3')
    expect(badge).toBeInTheDocument()
    expect(badge.className).toContain('bg-accent')
    expect(badge.className).toContain('text-accent-fg')
    expect(badge.className).toContain('font-bold')
  })

  it('omits badge entirely when unread_count === 0', () => {
    const item = { ...baseItem, unread_count: 0 }
    render(<QueueRow item={item} preview="Okay, thank you" selected={false} onSelect={vi.fn()} />)

    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })

  it('applies bold typography to customer name and preview for unread rows', () => {
    const unreadItem = { ...baseItem, unread_count: 2 }
    const { rerender } = render(<QueueRow item={unreadItem} preview="Unread message" selected={false} onSelect={vi.fn()} />)

    const nameEl = screen.getByText('Anjali Ramesh')
    expect(nameEl.className).toContain('font-bold')

    const readItem = { ...baseItem, unread_count: 0 }
    rerender(<QueueRow item={readItem} preview="Read message" selected={false} onSelect={vi.fn()} />)
    expect(nameEl.className).toContain('font-medium')
  })

  it('highlights timestamp with text-accent for calm unread items', () => {
    // 5 minutes ago = calm level
    const now = Date.now()
    const fiveMinAgo = new Date(now - 5 * 60_000).toISOString()
    const unreadItem = { ...baseItem, unread_count: 1, last_customer_message_at: fiveMinAgo }
    render(<QueueRow item={unreadItem} preview="Recent enquiry" selected={false} onSelect={vi.fn()} />)

    const stampEl = screen.getByText('5m')
    expect(stampEl.className).toContain('text-accent')
  })

  it('preserves solid badge contrast when selected is true', () => {
    const item = { ...baseItem, unread_count: 1 }
    render(<QueueRow item={item} preview="Test" selected={true} onSelect={vi.fn()} />)

    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('aria-current', 'true')
    expect(button.className).toContain('bg-accent-subtle')

    const badge = screen.getByText('1')
    expect(badge.className).toContain('bg-accent')
    expect(badge.className).toContain('text-accent-fg')
  })

  it('caps right-edge metadata to 2 chips when bot_paused and unread coexist', () => {
    const item = { ...baseItem, unread_count: 2, bot_paused: true }
    render(<QueueRow item={item} preview="Help needed" selected={false} onSelect={vi.fn()} assigneeLabel="You" />)

    expect(screen.getByText('Needs human')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.queryByText('You')).not.toBeInTheDocument()
  })
})
