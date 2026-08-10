import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const { from } = vi.hoisted(() => ({ from: vi.fn() }))
vi.mock('./supabase', () => ({ supabase: { from } }))

const { useQueue, useThread } = await import('./inbox-data')

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
