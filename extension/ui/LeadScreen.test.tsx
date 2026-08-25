import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { leadDetail, emptyLeadDetail, queueItems, VIEWER } from '../fixtures'
import { LeadScreen } from './LeadScreen'

describe('LeadScreen', () => {
  it('renders identity, stage, source and phone', () => {
    render(<LeadScreen detail={leadDetail} viewerId={VIEWER.user_id} />)
    expect(screen.getByText('Anjali Nair')).toBeInTheDocument()
    expect(screen.getByText('Proposal sent')).toBeInTheDocument()
    expect(screen.getByText('AI + rep')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+919845012345' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open chat' })).toBeInTheDocument()
  })

  it('shows the quiet owned-by line for another rep’s lead', () => {
    render(<LeadScreen detail={leadDetail} viewerId="someone-else" />)
    expect(screen.getByText('Owned by Joyal')).toBeInTheDocument()
  })

  it('stays quiet when the viewer owns the lead', () => {
    render(<LeadScreen detail={leadDetail} viewerId={VIEWER.user_id} />)
    expect(screen.queryByText(/Owned by/)).not.toBeInTheDocument()
  })

  it('distinguishes suggested from confirmed facts at a glance', () => {
    render(<LeadScreen detail={leadDetail} />)
    expect(screen.getAllByText(/confirmed/)).toHaveLength(2)
    expect(screen.getByText(/suggested · 61%/)).toBeInTheDocument()
  })

  it('lists objections with labels', () => {
    render(<LeadScreen detail={leadDetail} />)
    const section = screen.getByLabelText('Objections')
    expect(within(section).getByText('Price too high')).toBeInTheDocument()
  })

  it('marks api and rep timeline entries distinctly', () => {
    render(<LeadScreen detail={leadDetail} />)
    const history = screen.getByLabelText('History')
    expect(within(history).getAllByText('API').length).toBe(3)
    expect(within(history).getAllByText('REP').length).toBe(2)
    expect(within(history).getByText('Sharing the floor plan and payment schedule now.')).toBeInTheDocument()
    expect(within(history).getByText('Asked me to ring after 5 pm.')).toBeInTheDocument()
  })

  it('renders the no-history empty state instead of a blank block', () => {
    render(<LeadScreen detail={emptyLeadDetail} />)
    expect(screen.getByText('No history yet')).toBeInTheDocument()
  })

  it('handles a lead with no phone', () => {
    const noPhoneDetail = { ...emptyLeadDetail, lead: queueItems[3] }
    render(<LeadScreen detail={noPhoneDetail} />)
    expect(screen.getByText(/No phone number captured/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Open chat' })).not.toBeInTheDocument()
  })

  it('back button fires onBack', async () => {
    const onBack = vi.fn()
    render(<LeadScreen detail={leadDetail} onBack={onBack} />)
    await userEvent.click(screen.getByRole('button', { name: 'Back to queue' }))
    expect(onBack).toHaveBeenCalledOnce()
  })
})
