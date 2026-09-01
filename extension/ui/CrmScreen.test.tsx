import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { queueItems } from '../fixtures'
import { CrmScreen, sinceFor } from './CrmScreen'

const base = {
  items: queueItems,
  dateFilter: 'any' as const,
  onDateFilter: vi.fn(),
  onAddLead: vi.fn(),
  onOpenLead: vi.fn(),
}

describe('sinceFor', () => {
  const now = new Date('2026-09-02T12:00:00.000Z')

  it('is null for "any time" — no filter reaches the query at all', () => {
    expect(sinceFor('any', now)).toBeNull()
  })

  it('walks back the right number of days', () => {
    expect(sinceFor('today', now)).toBe('2026-09-01T12:00:00.000Z')
    expect(sinceFor('week', now)).toBe('2026-08-26T12:00:00.000Z')
    expect(sinceFor('month', now)).toBe('2026-08-03T12:00:00.000Z')
  })
})

describe('CrmScreen', () => {
  it('lists the book', () => {
    render(<CrmScreen {...base} />)
    expect(screen.getByText('Anjali Nair')).toBeInTheDocument()
    expect(screen.getByText('Rahul Menon')).toBeInTheDocument()
  })

  it('is a CRM, not a queue — no "next lead" call to action', () => {
    render(<CrmScreen {...base} />)
    expect(screen.queryByRole('button', { name: /Open next lead/ })).not.toBeInTheDocument()
  })

  it('row click opens the lead', async () => {
    const onOpenLead = vi.fn()
    render(<CrmScreen {...base} onOpenLead={onOpenLead} />)
    await userEvent.click(screen.getByText('Fatima Zahra'))
    expect(onOpenLead).toHaveBeenCalledWith(queueItems[2])
  })

  it('searches by name and by number', async () => {
    render(<CrmScreen {...base} />)
    const search = screen.getByLabelText('Search leads')
    await userEvent.type(search, 'anjali')
    expect(screen.getByText('Anjali Nair')).toBeInTheDocument()
    expect(screen.queryByText('Rahul Menon')).not.toBeInTheDocument()

    await userEvent.clear(search)
    await userEvent.type(search, '67890')
    expect(screen.getByText('Rahul Menon')).toBeInTheDocument()
    expect(screen.queryByText('Anjali Nair')).not.toBeInTheDocument()
  })

  it('offers Add straight from a fruitless search, carrying the term', async () => {
    const onAddLead = vi.fn()
    render(<CrmScreen {...base} onAddLead={onAddLead} />)
    await userEvent.type(screen.getByLabelText('Search leads'), 'zzzz')
    expect(screen.getByText(/No match for “zzzz”/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Add “zzzz” as a lead/ }))
    expect(onAddLead).toHaveBeenCalled()
  })

  it('Add is reachable with the list full, not only when empty', async () => {
    const onAddLead = vi.fn()
    render(<CrmScreen {...base} onAddLead={onAddLead} />)
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(onAddLead).toHaveBeenCalled()
  })

  it('reports the chosen date window back to the panel', async () => {
    const onDateFilter = vi.fn()
    render(<CrmScreen {...base} onDateFilter={onDateFilter} />)
    await userEvent.click(screen.getByRole('button', { name: '7 days' }))
    expect(onDateFilter).toHaveBeenCalledWith('week')
  })

  it('distinguishes an empty window from an empty book', () => {
    const { unmount } = render(<CrmScreen {...base} items={[]} dateFilter="week" />)
    expect(screen.getByText('Nothing in this window')).toBeInTheDocument()
    unmount()
    render(<CrmScreen {...base} items={[]} />)
    expect(screen.getByText('No leads yet')).toBeInTheDocument()
  })

  it('shows when cached data was fetched', () => {
    render(<CrmScreen {...base} staleAt="2026-08-26T10:00:00.000Z" />)
    expect(screen.getByText(/Cached/)).toBeInTheDocument()
  })

  it('debounces search to the server and can request another page', async () => {
    const onSearch = vi.fn()
    const onLoadMore = vi.fn()
    render(<CrmScreen {...base} onSearch={onSearch} hasMore onLoadMore={onLoadMore} />)
    await userEvent.type(screen.getByLabelText('Search leads'), 'anj')
    await new Promise((resolve) => setTimeout(resolve, 350))
    expect(onSearch).toHaveBeenCalledWith('anj')
    await userEvent.click(screen.getByRole('button', { name: 'Load more' }))
    expect(onLoadMore).toHaveBeenCalled()
  })
})
