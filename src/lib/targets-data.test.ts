import { beforeEach, describe, expect, it, vi } from 'vitest'

const { from, operations } = vi.hoisted(() => ({
  from: vi.fn(),
  operations: [] as Array<{ method: string; args: unknown[] }>,
}))

vi.mock('./supabase', () => ({ supabase: { from } }))

const { readOwnTarget } = await import('./targets-data')

function queryResult(data: unknown) {
  const chain: Record<string, (...args: unknown[]) => unknown> = {}
  for (const method of ['select', 'eq']) {
    chain[method] = (...args: unknown[]) => {
      operations.push({ method, args })
      return chain
    }
  }
  chain.maybeSingle = async () => ({ data, error: null })
  return chain
}

describe('personal target read', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    operations.length = 0
  })

  it('filters employee_targets to this tenant, this rep, and this month only', async () => {
    from.mockReturnValue(queryResult({ id: 'target-own' }))

    const result = await readOwnTarget('client-own', 'rep-own', '2026-08-01')

    expect(from).toHaveBeenCalledWith('employee_targets')
    expect(operations.filter((op) => op.method === 'eq').map((op) => op.args)).toEqual([
      ['client_id', 'client-own'],
      ['user_id', 'rep-own'],
      ['month', '2026-08-01'],
    ])
    expect(result.data).toEqual({ id: 'target-own' })
  })
})
