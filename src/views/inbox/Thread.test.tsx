import { render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'
import { Thread } from './Thread'

beforeAll(() => {
  Element.prototype.scrollIntoView = () => {}
})

describe('Thread empty state', () => {
  it('explains that a conversation has no messages instead of rendering a blank pane', () => {
    render(<Thread messages={[]} traces={[]} />)

    expect(screen.getByText('No messages here yet.')).toBeInTheDocument()
    expect(screen.getByText(/Send the first message below/)).toBeInTheDocument()
  })
})

describe('Thread with messages', () => {
  it('renders a bubble for every message instead of a blank pane', () => {
    render(
      <Thread
        messages={[
          {
            id: 'm1',
            direction: 'inbound',
            sender_type: 'customer',
            msg_type: 'text',
            body: 'Hello, is the batch still open',
            media: null,
            transcription: null,
            delivery_status: '',
            failure_reason: null,
            created_at: '2026-08-01T09:10:00Z',
          },
          {
            id: 'm2',
            direction: 'outbound',
            sender_type: 'bot',
            msg_type: 'text',
            body: 'Yes, seats are open.',
            media: null,
            transcription: null,
            delivery_status: 'read',
            failure_reason: null,
            created_at: '2026-08-01T09:11:00Z',
          },
        ]}
        traces={[]}
      />,
    )

    expect(screen.getByText('Hello, is the batch still open')).toBeInTheDocument()
    expect(screen.getByText('Yes, seats are open.')).toBeInTheDocument()
  })
})
