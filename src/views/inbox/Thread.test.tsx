import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { Thread } from './Thread'
import type { Message } from '../../lib/inbox-data'

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

function optimisticMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'optimistic:temp-1',
    sender_type: 'agent',
    direction: 'outbound',
    body: 'Hang on, checking',
    msg_type: 'text',
    created_at: '2026-08-11T09:00:00Z',
    media: null,
    delivery_status: 'pending',
    failure_reason: null,
    transcription: null,
    ...overrides,
  }
}

describe('Thread optimistic bubble rendering (S1, issue #15)', () => {
  it('shows a pending indicator instead of a sent/read checkmark', () => {
    render(<Thread messages={[optimisticMessage()]} traces={[]} />)

    expect(screen.getByText('Hang on, checking')).toBeInTheDocument()
    expect(screen.getByLabelText('Sending')).toBeInTheDocument()
    expect(screen.queryByLabelText('Read')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Sent')).not.toBeInTheDocument()
  })

  it('offers a retry affordance for a failed optimistic bubble, wired to onRetryFailed', async () => {
    const user = userEvent.setup()
    const onRetryFailed = vi.fn()
    render(
      <Thread
        messages={[optimisticMessage({ delivery_status: 'failed', failure_reason: null })]}
        traces={[]}
        onRetryFailed={onRetryFailed}
      />,
    )

    const retry = screen.getByRole('button', { name: /Didn.t send.*Tap to retry/i })
    await user.click(retry)

    expect(onRetryFailed).toHaveBeenCalledWith('optimistic:temp-1', 'Hang on, checking')
  })

  it('does not offer retry for a real (non-optimistic) failed row', () => {
    const onRetryFailed = vi.fn()
    render(
      <Thread
        messages={[optimisticMessage({ id: 'real-message-id', delivery_status: 'failed' })]}
        traces={[]}
        onRetryFailed={onRetryFailed}
      />,
    )

    expect(screen.queryByRole('button', { name: /Tap to retry/i })).not.toBeInTheDocument()
    expect(screen.getByText(/Didn.t send/i)).toBeInTheDocument()
  })
})
