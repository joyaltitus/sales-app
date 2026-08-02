import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const { from } = vi.hoisted(() => ({ from: vi.fn() }))
vi.mock('./supabase', () => ({ supabase: { from } }))

const { useThread } = await import('./inbox-data')

describe('useThread', () => {
  it('settles without querying when no active client is available', async () => {
    const { result } = renderHook(() => useThread(null, 'conversation-deep-link'))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.messages).toEqual([])
    expect(result.current.error).toBeNull()
    expect(from).not.toHaveBeenCalled()
  })
})
