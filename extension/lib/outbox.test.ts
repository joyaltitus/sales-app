import { describe, expect, it, vi } from 'vitest'
import { drain, enqueue, OUTBOX_LIMIT, type DrainResult } from './outbox'
import type { OutboxEntry } from './contracts'

function entry(over: Partial<OutboxEntry> = {}): OutboxEntry {
  return {
    id: 'id-0',
    kind: 'add_note',
    args: { body: 'hi' },
    created_at: '2026-08-25T10:00:00Z',
    attempts: 0,
    last_error: null,
    ...over,
  }
}

describe('outbox.enqueue', () => {
  it('appends the entry and returns the new list', () => {
    const list = [entry({ id: 'a' })]
    const result = enqueue(list, entry({ id: 'b' }))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.list.map((e) => e.id)).toEqual(['a', 'b'])
      expect(result.list).not.toBe(list)
    }
  })

  it('refuses the 201st entry with a named error', () => {
    const full = Array.from({ length: OUTBOX_LIMIT }, (_, i) => entry({ id: `e${i}` }))
    expect(full).toHaveLength(201 - 1)
    const result = enqueue(full, entry({ id: 'one-too-many' }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('OUTBOX_FULL')
  })

  it('never drops the oldest entry to make room — the original list survives intact', () => {
    const full = Array.from({ length: OUTBOX_LIMIT }, (_, i) => entry({ id: `e${i}` }))
    const result = enqueue(full, entry({ id: 'rejected' }))
    expect(result.list).toHaveLength(OUTBOX_LIMIT)
    expect(result.list[0].id).toBe('e0')
    expect(result.list[OUTBOX_LIMIT - 1].id).toBe(`e${OUTBOX_LIMIT - 1}`)
    expect(result.list.some((e) => e.id === 'rejected')).toBe(false)
  })
})

describe('outbox.drain', () => {
  it('runs entries oldest-first and drains everything when no run fails', async () => {
    const list = [entry({ id: 'first' }), entry({ id: 'second' }), entry({ id: 'third' })]
    const seen: string[] = []
    const result = await drain(list, (e) => {
      seen.push(e.id)
    })
    expect(seen).toEqual(['first', 'second', 'third'])
    const r: DrainResult = result
    expect(r.done).toBe(3)
    expect(r.failed).toBeNull()
    expect(r.remaining).toEqual([])
  })

  it('stops at the first failure — later entries are never attempted', async () => {
    const list = [entry({ id: 'ok' }), entry({ id: 'boom' }), entry({ id: 'never' })]
    const run = vi.fn((e: OutboxEntry) => {
      if (e.id === 'boom') throw new Error('network down')
    })
    const result = await drain(list, run)
    expect(run).toHaveBeenCalledTimes(2)
    expect(result.done).toBe(1)
    expect(result.failed!.id).toBe('boom')
    expect(result.remaining.map((e) => e.id)).toEqual(['boom', 'never'])
  })

  it('increments attempts and sets last_error on the failed entry only', async () => {
    const list = [
      entry({ id: 'ok', attempts: 2 }),
      entry({ id: 'boom', attempts: 1, last_error: null }),
    ]
    const result = await drain(list, (e) => {
      if (e.id === 'boom') throw new Error('rls denied')
    })
    expect(result.failed).toMatchObject({ id: 'boom', attempts: 2, last_error: 'rls denied' })
    // the failed entry inside remaining carries the update too
    expect(result.remaining[0]).toMatchObject({ id: 'boom', attempts: 2, last_error: 'rls denied' })
    // untouched survivor keeps its shape
    expect(list.find((e) => e.id === 'boom')).toMatchObject({ attempts: 1, last_error: null })
  })

  it('stringifies non-Error rejections instead of crashing', async () => {
    const result = await drain([entry()], () => Promise.reject('plain string'))
    expect(result.failed!.last_error).toBe('plain string')
  })

  it('catches a synchronous throw from run as a failure too', async () => {
    const result = await drain([entry()], () => {
      throw new Error('sync boom')
    })
    expect(result.done).toBe(0)
    expect(result.failed!.last_error).toBe('sync boom')
    expect(result.remaining).toHaveLength(1)
  })

  it('drains an empty outbox to nothing', async () => {
    const result = await drain([], () => undefined)
    expect(result).toEqual({ remaining: [], done: 0, failed: null })
  })
})
