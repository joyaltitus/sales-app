import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { from, operations } = vi.hoisted(() => ({
  from: vi.fn(),
  operations: [] as Array<{ method: string; args: unknown[] }>,
}))

vi.mock('./supabase', () => ({ supabase: { from } }))

const { parseMoney, readOwnTarget, useOwnWonValue } = await import('./targets-data')

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

function wonValueChain(data: unknown) {
  const chain: Record<string, (...args: unknown[]) => unknown> = {}
  for (const method of ['select', 'eq', 'gte']) {
    chain[method] = (...args: unknown[]) => {
      operations.push({ method, args })
      return chain
    }
  }
  chain.lt = (...args: unknown[]) => {
    operations.push({ method: 'lt', args })
    return Promise.resolve({ data, error: null })
  }
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

describe('useOwnWonValue month window (UTC boundary)', () => {
  const realTZ = process.env.TZ

  beforeEach(() => {
    vi.clearAllMocks()
    operations.length = 0
  })

  afterEach(() => {
    if (realTZ === undefined) delete process.env.TZ
    else process.env.TZ = realTZ
  })

  it('builds the month window in UTC, not local time', async () => {
    process.env.TZ = 'Asia/Kolkata'
    from.mockReturnValue(wonValueChain([{ est_value: 5000 }, { est_value: 2500 }]))

    const { result } = renderHook(() => useOwnWonValue('client-own', 'rep-own', '2026-08-01'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(from).toHaveBeenCalledWith('leads')
    const gte = operations.find((op) => op.method === 'gte')
    const lt = operations.find((op) => op.method === 'lt')
    expect(gte?.args).toEqual(['updated_at', '2026-08-01T00:00:00.000Z'])
    expect(lt?.args).toEqual(['updated_at', '2026-09-01T00:00:00.000Z'])
    expect(result.current.value).toBe(7500)
  })
})

// One parser, two screens: TargetsPage and the Todos SetTargetForm both upsert
// employee_targets on (client_id, user_id, month). Anything this accepts is a
// number that overwrites a rep's month.
describe('parseMoney', () => {
  it('reads blank as no value, so a caller decides what blank means', () => {
    expect(parseMoney('')).toBeNull()
    expect(parseMoney('   ')).toBeNull()
  })

  it('refuses junk instead of coercing it to zero', () => {
    expect(parseMoney('abc')).toBeNull()
    expect(parseMoney('12abc')).toBeNull()
  })

  it('refuses a negative — a number input accepts one, min="0" does not stop it', () => {
    expect(parseMoney('-1')).toBeNull()
    expect(parseMoney('-250000')).toBeNull()
  })

  it('refuses a value past the sanity cap and anything non-finite', () => {
    expect(parseMoney('100000001')).toBeNull()
    expect(parseMoney('1e999')).toBeNull()
    expect(parseMoney('Infinity')).toBeNull()
  })

  it('accepts a real amount and rounds to whole rupees', () => {
    expect(parseMoney('250000')).toBe(250_000)
    expect(parseMoney('0')).toBe(0)
    expect(parseMoney('1234.6')).toBe(1235)
  })
})
