import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const { from, channel, removeChannel, createSignedUrl } = vi.hoisted(() => ({
  from: vi.fn(),
  channel: vi.fn(),
  removeChannel: vi.fn(),
  createSignedUrl: vi.fn(),
}))
vi.mock('./supabase', () => ({
  supabase: { from, channel, removeChannel, storage: { from: () => ({ createSignedUrl }) } },
}))

const { useQueue, useThread, useLiveRefresh, mergeOutbound, getInboundMediaSignedUrl, usePreviews } =
  await import('./inbox-data')
type Message = import('./inbox-data').Message
type OptimisticBubble = import('./inbox-data').OptimisticBubble

const PIXELLEDU_ID = 'cc4a7484-064e-495c-b611-b5ca105410f7'

describe('useQueue', () => {
  it('scopes PixellEdu queue reads to PixellEdu', async () => {
    const eq = vi.fn()
    const limit = vi.fn().mockResolvedValue({ data: [], error: null })
    const order = vi.fn(() => ({ limit }))
    eq.mockReturnValue({ order })
    from.mockReturnValue({ select: vi.fn(() => ({ eq })) })

    const { result } = renderHook(() => useQueue(PIXELLEDU_ID))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(eq).toHaveBeenCalledWith('client_id', PIXELLEDU_ID)
  })

  // #18: the AI Summary rail hydrates from the persisted rolling_summary on
  // thread open, so the queue read shape must carry it (and summary_upto, the
  // cut-off used to detect staleness) alongside the other conversation rows.
  it('reads the persisted AI summary columns for rail hydration', async () => {
    const eq = vi.fn()
    const limit = vi.fn().mockResolvedValue({ data: [], error: null })
    const order = vi.fn(() => ({ limit }))
    const select = vi.fn(() => ({ eq }))
    eq.mockReturnValue({ order })
    from.mockReturnValue({ select })

    const { result } = renderHook(() => useQueue(PIXELLEDU_ID))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(select).toHaveBeenCalledWith(expect.stringContaining('rolling_summary'))
    expect(select).toHaveBeenCalledWith(expect.stringContaining('summary_upto'))
  })
})

describe('useThread', () => {
  it('settles without querying when no active client is available', async () => {
    const { result } = renderHook(() => useThread(null, 'conversation-deep-link'))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.messages).toEqual([])
    expect(result.current.error).toBeNull()
    expect(from).not.toHaveBeenCalled()
  })

  // #90 Part 6: real inbound media lives in `inbound_media`, joined onto its
  // message by channel_message_id — never in the unused `messages.media` column.
  it('scopes the inbound_media read to client_id + conversation_id and maps rows by channel_message_id', async () => {
    const chainOf = (limit: ReturnType<typeof vi.fn>) => {
      const chain: Record<string, ReturnType<typeof vi.fn>> = {}
      chain.select = vi.fn(() => chain)
      chain.eq = vi.fn(() => chain)
      chain.order = vi.fn(() => chain)
      chain.limit = limit
      return chain
    }
    const messagesChain = chainOf(vi.fn().mockResolvedValue({ data: [], error: null }))
    const tracesChain = chainOf(vi.fn().mockResolvedValue({ data: [], error: null }))
    const mediaRow = {
      channel_message_id: 'wamid.1',
      storage_bucket: 'inbound-media',
      storage_path: `${PIXELLEDU_ID}/conv-1/wamid.1.jpg`,
      mime: 'image/jpeg',
      media_type: 'document',
    }
    const mediaChain = chainOf(vi.fn().mockResolvedValue({ data: [mediaRow], error: null }))

    from.mockImplementation((table: string) => {
      if (table === 'messages') return messagesChain
      if (table === 'turn_traces') return tracesChain
      if (table === 'inbound_media') return mediaChain
      throw new Error(`unexpected table ${table}`)
    })

    const { result } = renderHook(() => useThread(PIXELLEDU_ID, 'conv-1'))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(mediaChain.eq).toHaveBeenCalledWith('client_id', PIXELLEDU_ID)
    expect(mediaChain.eq).toHaveBeenCalledWith('conversation_id', 'conv-1')
    expect(result.current.media.get('wamid.1')).toEqual(mediaRow)
  })
})

describe('getInboundMediaSignedUrl', () => {
  it('resolves the signed URL on success', async () => {
    createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://signed.example/x' }, error: null })

    await expect(getInboundMediaSignedUrl('client/conv/wamid.jpg')).resolves.toBe(
      'https://signed.example/x',
    )
  })

  it('degrades to null on a storage error instead of throwing', async () => {
    createSignedUrl.mockResolvedValue({ data: null, error: { message: 'not found' } })

    await expect(getInboundMediaSignedUrl('client/conv/missing.jpg')).resolves.toBeNull()
  })
})

function outboundMessage(id: string, body: string, createdAt: string): Message {
  return {
    id,
    sender_type: 'agent',
    direction: 'outbound',
    body,
    msg_type: 'text',
    created_at: createdAt,
    media: null,
    delivery_status: 'sent',
    failure_reason: null,
    transcription: null,
  }
}

function bubble(tempId: string, body: string, status: OptimisticBubble['status'] = 'pending'): OptimisticBubble {
  return { tempId, body, status, createdAt: '2026-08-11T09:00:00Z' }
}

describe('mergeOutbound (S1, issue #15: exact-once reconciliation)', () => {
  it('claims the pending bubble once its authoritative row arrives, without duplicating it', () => {
    const authoritative = [outboundMessage('m1', 'Hi there', '2026-08-11T09:00:01Z')]
    const merged = mergeOutbound(authoritative, [bubble('optimistic:1', 'Hi there')])

    expect(merged).toHaveLength(1)
    expect(merged[0].id).toBe('m1')
  })

  it('reconciles two sequential identical-text sends positionally, never collapsing them', () => {
    const authoritative = [
      outboundMessage('m1', 'On it', '2026-08-11T09:00:01Z'),
      outboundMessage('m2', 'On it', '2026-08-11T09:00:05Z'),
    ]
    const merged = mergeOutbound(authoritative, [bubble('optimistic:1', 'On it'), bubble('optimistic:2', 'On it')])

    expect(merged.map((m) => m.id)).toEqual(['m1', 'm2'])
  })

  it('keeps an unmatched pending bubble visible when the authoritative refetch has not caught up yet', () => {
    // Simulates a refetch that raced ahead of the send worker: the row does
    // not exist yet, so the bubble must not flicker away.
    const merged = mergeOutbound([], [bubble('optimistic:1', 'Still sending')])

    expect(merged).toHaveLength(1)
    expect(merged[0].id).toBe('optimistic:1')
    expect(merged[0].delivery_status).toBe('pending')
  })

  it('never matches a failed bubble against an authoritative row', () => {
    const authoritative = [outboundMessage('m1', 'Same text', '2026-08-11T09:00:01Z')]
    const merged = mergeOutbound(authoritative, [bubble('optimistic:1', 'Same text', 'failed')])

    expect(merged.map((m) => m.id)).toEqual(['m1', 'optimistic:1'])
    expect(merged[1].delivery_status).toBe('failed')
  })
})

describe('useLiveRefresh (S1, issue #15: direct-paint on messages INSERT)', () => {
  it('invokes onMessageInsert synchronously, ahead of the 400ms-debounced onChange', () => {
    vi.useFakeTimers()
    try {
      const handlers: Record<string, (payload: unknown) => void> = {}
      const chan = {
        on: vi.fn((_event: string, config: { table: string; event: string }, handler: (p: unknown) => void) => {
          handlers[`${config.table}:${config.event}`] = handler
          return chan
        }),
        subscribe: vi.fn((cb?: (status: string) => void) => {
          cb?.('SUBSCRIBED')
          return chan
        }),
      }
      channel.mockReturnValue(chan)

      const onChange = vi.fn()
      const onMessageInsert = vi.fn()
      renderHook(() => useLiveRefresh('pixelledu', onChange, onMessageInsert))

      const insertHandler = handlers['messages:INSERT']
      expect(insertHandler).toBeTypeOf('function')

      const row = { id: 'm1', conversation_id: 'c1' }
      insertHandler({ new: row })

      expect(onMessageInsert).toHaveBeenCalledWith(row)
      expect(onChange).not.toHaveBeenCalled()

      vi.advanceTimersByTime(400)
      expect(onChange).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('usePreviews (AT-03: unsupported media placeholder)', () => {
  it('renders [unsupported] for unsupported msg_type matching thread view', async () => {
    const chainOf = (limit: ReturnType<typeof vi.fn>) => {
      const chain: Record<string, ReturnType<typeof vi.fn>> = {}
      chain.select = vi.fn(() => chain)
      chain.eq = vi.fn(() => chain)
      chain.order = vi.fn(() => chain)
      chain.limit = limit
      return chain
    }
    const messagesChain = chainOf(
      vi.fn().mockResolvedValue({
        data: [
          {
            conversation_id: 'conv-unsupported',
            body: null,
            transcription: null,
            msg_type: 'unsupported',
            created_at: '2026-08-11T09:00:00Z',
          },
        ],
        error: null,
      }),
    )
    from.mockReturnValue(messagesChain)

    const { result } = renderHook(() => usePreviews(PIXELLEDU_ID))
    await waitFor(() => expect(result.current.previews.size).toBe(1))

    expect(result.current.previews.get('conv-unsupported')).toEqual({
      text: '[unsupported]',
      kind: 'other',
    })
  })
})
