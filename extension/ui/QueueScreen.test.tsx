import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { queueItems, targetBar } from '../fixtures'
import { QueueScreen } from './QueueScreen'
import { TargetBar } from './TargetBar'

describe('QueueScreen', () => {
  it('renders queue rows from fixtures', () => {
    render(<QueueScreen items={queueItems} onNext={vi.fn()} onOpenLead={vi.fn()} />)
    expect(screen.getByText('Anjali Nair')).toBeInTheDocument()
    expect(screen.getByText('Rahul Menon')).toBeInTheDocument()
    expect(screen.getAllByText(/overdue|new|due|idle/).length).toBeGreaterThan(0)
  })

  it('Next opens the top item', async () => {
    const onNext = vi.fn()
    render(<QueueScreen items={queueItems} onNext={onNext} onOpenLead={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /Open next lead: Anjali Nair/ }))
    expect(onNext).toHaveBeenCalledWith(queueItems[0])
  })

  it('row click opens the lead', async () => {
    const onOpenLead = vi.fn()
    render(<QueueScreen items={queueItems} onNext={vi.fn()} onOpenLead={onOpenLead} />)
    await userEvent.click(screen.getByText('Fatima Zahra'))
    expect(onOpenLead).toHaveBeenCalledWith(queueItems[2])
  })

  it('search filters by name and number', async () => {
    render(<QueueScreen items={queueItems} onNext={vi.fn()} onOpenLead={vi.fn()} />)
    const search = screen.getByLabelText('Search leads')
    await userEvent.type(search, 'anjali')
    expect(screen.getByText('Anjali Nair')).toBeInTheDocument()
    expect(screen.queryByText('Rahul Menon')).not.toBeInTheDocument()

    await userEvent.clear(search)
    await userEvent.type(search, '67890')
    expect(screen.getByText('Rahul Menon')).toBeInTheDocument()
    expect(screen.queryByText('Anjali Nair')).not.toBeInTheDocument()
  })

  it('shows the no-match empty state for a fruitless search', async () => {
    render(<QueueScreen items={queueItems} onNext={vi.fn()} onOpenLead={vi.fn()} />)
    await userEvent.type(screen.getByLabelText('Search leads'), 'zzzz')
    expect(screen.getByText(/No match for “zzzz”/)).toBeInTheDocument()
  })

  it('empty queue reads "Nothing due — nice."', () => {
    render(<QueueScreen items={[]} onNext={vi.fn()} onOpenLead={vi.fn()} />)
    expect(screen.getByText('Nothing due — nice.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Open next lead/ })).not.toBeInTheDocument()
  })

  it('renders the target bar slot above the queue', () => {
    render(
      <QueueScreen
        items={queueItems}
        target={<TargetBar {...targetBar} />}
        onNext={vi.fn()}
        onOpenLead={vi.fn()}
      />,
    )
    expect(screen.getByLabelText(/^Target for Joyal:/)).toBeInTheDocument()
    expect(screen.getByText('Anjali Nair')).toBeInTheDocument()
  })

  it('shows when cached queue data was fetched', () => {
    render(
      <QueueScreen
        items={queueItems}
        staleAt="2026-08-26T10:00:00.000Z"
        onNext={vi.fn()}
        onOpenLead={vi.fn()}
      />,
    )
    expect(screen.getByText(/Cached/)).toBeInTheDocument()
  })
})
