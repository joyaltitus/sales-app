import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { Thread } from './Thread'
import type { InboundMediaRow, Message } from '../../lib/inbox-data'

// #90 Part 6: the real signed-URL fetch hits Supabase Storage over the
// network — mocked here so the bubble render tests stay hermetic. Everything
// else in inbox-data (messageKind, types) passes through untouched.
const { getInboundMediaSignedUrl } = vi.hoisted(() => ({ getInboundMediaSignedUrl: vi.fn() }))
vi.mock('../../lib/inbox-data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/inbox-data')>()
  return { ...actual, getInboundMediaSignedUrl }
})

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

// #90 Part 6: real inbound media (image/audio/document), joined by
// channel_message_id — with an explicit regression guard for the common case
// today, a media message with no matching inbound_media row.
describe('Thread inbound media', () => {
  const imageMessage: Message = {
    id: 'm1',
    direction: 'inbound',
    sender_type: 'customer',
    msg_type: 'document',
    body: null,
    media: null,
    channel_message_id: 'wamid.1',
    transcription: null,
    delivery_status: '',
    failure_reason: null,
    created_at: '2026-08-01T09:10:00Z',
  }
  const imageMediaRow: InboundMediaRow = {
    channel_message_id: 'wamid.1',
    storage_bucket: 'inbound-media',
    storage_path: 'client/conv/wamid.1.jpg',
    mime: 'image/jpeg',
    media_type: 'document',
  }

  it('renders a real image once its signed URL resolves', async () => {
    getInboundMediaSignedUrl.mockResolvedValue('https://signed.example/wamid.1.jpg')

    render(
      <Thread
        messages={[imageMessage]}
        traces={[]}
        media={new Map([[imageMediaRow.channel_message_id, imageMediaRow]])}
      />,
    )

    const img = await waitFor(() => screen.getByRole('img'))
    expect(img).toHaveAttribute('src', 'https://signed.example/wamid.1.jpg')
  })

  it('falls back to the [msg_type] placeholder when no inbound_media row matches — the common case today', () => {
    render(<Thread messages={[imageMessage]} traces={[]} media={new Map()} />)

    expect(screen.getByText('[document]')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
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
