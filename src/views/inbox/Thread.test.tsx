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

  // FLIPPED, intentionally (REG-039). The button said "Tap to retry" and no code
  // anywhere resent the message: the handler deletes the bubble and seeds the
  // composer. Joyal's call on 2026-09-05 was to rename rather than build a
  // resend, so this name matcher moves with the label.
  it('offers a copy-to-composer affordance for a failed optimistic bubble', async () => {
    const user = userEvent.setup()
    const onCopyToComposer = vi.fn()
    render(
      <Thread
        messages={[optimisticMessage({ delivery_status: 'failed', failure_reason: null })]}
        traces={[]}
        onCopyToComposer={onCopyToComposer}
      />,
    )

    expect(screen.queryByRole('button', { name: /tap to retry/i })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Didn.t send.*Copy to composer/i }))

    expect(onCopyToComposer).toHaveBeenCalledWith('optimistic:temp-1', 'Hang on, checking')
  })

  it('does not offer copy-to-composer for a real (non-optimistic) failed row', () => {
    const onCopyToComposer = vi.fn()
    render(
      <Thread
        messages={[optimisticMessage({ id: 'real-message-id', delivery_status: 'failed' })]}
        traces={[]}
        onCopyToComposer={onCopyToComposer}
      />,
    )

    expect(screen.queryByRole('button', { name: /Copy to composer/i })).not.toBeInTheDocument()
    expect(screen.getByText(/Didn.t send/i)).toBeInTheDocument()
  })
})

// REG-007. Every fixture above uses `failure_reason: null`, so this path had no
// coverage at all — which is how a raw Graph API string reached a bubble the rep
// reads next to the customer's own words.
describe('Thread failed-message reasons', () => {
  const RAW = '(#131047) Message failed to send because more than 24 hours have passed'

  it('keeps the raw upstream reason out of the bubble on a recoverable failure', () => {
    render(
      <Thread
        messages={[optimisticMessage({ delivery_status: 'failed', failure_reason: RAW })]}
        traces={[]}
        onCopyToComposer={vi.fn()}
      />,
    )

    expect(screen.queryByText(new RegExp(RAW.slice(0, 12).replace(/[()#]/g, '.'), 'i'))).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Didn.t send.*Copy to composer/i })).toBeInTheDocument()
  })

  it('keeps it out of a real failed row too, and still says the send failed', () => {
    render(
      <Thread
        messages={[optimisticMessage({ id: 'real-1', delivery_status: 'failed', failure_reason: RAW })]}
        traces={[]}
      />,
    )

    expect(screen.getByText(/Didn.t send/i)).toBeInTheDocument()
    expect(screen.queryByText(/24 hours have passed/i)).not.toBeInTheDocument()
  })

  it('still carries the reason in the DOM for support, just not as rendered text', () => {
    const { container } = render(
      <Thread
        messages={[optimisticMessage({ id: 'real-1', delivery_status: 'failed', failure_reason: RAW })]}
        traces={[]}
      />,
    )

    expect(container.querySelector('[data-failure-reason]')).toHaveAttribute('data-failure-reason', RAW)
  })
})
