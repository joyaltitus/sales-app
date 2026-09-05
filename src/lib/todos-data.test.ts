import { describe, expect, it, vi, beforeEach } from 'vitest'

// toggleTodo is the only write on employee_todos that a rep can fire from two
// screens. It used to be unconditional: whoever wrote last won, silently, even
// over a status someone else had just set.
const { from, operations } = vi.hoisted(() => ({
  from: vi.fn(),
  operations: [] as Array<{ method: string; args: unknown[] }>,
}))
vi.mock('./supabase', () => ({ supabase: { from } }))

const { toggleTodo } = await import('./todos-data')

function updateChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, (...args: unknown[]) => unknown> = {}
  for (const method of ['update', 'eq']) {
    chain[method] = (...args: unknown[]) => {
      operations.push({ method, args })
      return chain
    }
  }
  chain.select = (...args: unknown[]) => {
    operations.push({ method: 'select', args })
    return Promise.resolve(result)
  }
  return chain
}

describe('toggleTodo', () => {
  beforeEach(() => {
    operations.length = 0
    from.mockReset()
  })

  it('makes the write conditional on the status the caller read', async () => {
    from.mockReturnValue(updateChain({ data: [{ id: 't-1' }], error: null }))

    await toggleTodo('c-1', 't-1', 'done', 'pending')

    const eqs = operations.filter((o) => o.method === 'eq').map((o) => o.args)
    expect(eqs).toContainEqual(['client_id', 'c-1'])
    expect(eqs).toContainEqual(['id', 't-1'])
    expect(eqs).toContainEqual(['status', 'pending'])
  })

  it('reads zero matched rows as denied, not as success', async () => {
    from.mockReturnValue(updateChain({ data: [], error: null }))

    await expect(toggleTodo('c-1', 't-1', 'done', 'pending')).resolves.toEqual({
      ok: false,
      reason: 'denied',
    })
  })

  it('keeps a transport error distinguishable from a denial', async () => {
    from.mockReturnValue(updateChain({ data: null, error: { message: 'network down' } }))

    await expect(toggleTodo('c-1', 't-1', 'done', 'pending')).resolves.toEqual({
      ok: false,
      reason: 'error',
      message: 'network down',
    })
  })

  it('clears completed_at when reopening and sets it when completing', async () => {
    from.mockReturnValue(updateChain({ data: [{ id: 't-1' }], error: null }))
    await toggleTodo('c-1', 't-1', 'pending', 'done')
    const [patch] = operations.find((o) => o.method === 'update')!.args as [Record<string, unknown>]
    expect(patch.status).toBe('pending')
    expect(patch.completed_at).toBeNull()
  })
})
