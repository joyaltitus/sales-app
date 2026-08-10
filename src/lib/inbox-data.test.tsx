import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const { from, channel, removeChannel } = vi.hoisted(() => ({
  from: vi.fn(),
  channel: vi.fn(),
  removeChannel: vi.fn(),
}))
vi.mock('./supabase', () => ({ supabase: { from, channel, removeChannel } }))

const { useQueue, useThread, useLiveRefresh, mergeOutbound } = await import('./inbox-data')
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
})

describe('useThread', () => {
  it('settles without querying when no active client is available', async () => {
    const { result } = renderHook(() => useThread(null, 'conversation-deep-link'))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.messages).toEqual([])
    expect(result.current.error).toBeNull()
    expect(from).not.toHaveBeenCalled()
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
