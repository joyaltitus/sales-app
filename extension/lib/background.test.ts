import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CHAT_TAB_KEY,
  NOTIFIED_FOLLOW_UPS_KEY,
  openChatTab,
  processAlarmTick,
} from './background'

describe('alarm tick', () => {
  it('notifies one due follow-up exactly once across three ticks and clears the badge at zero', async () => {
    const store: Record<string, unknown> = {}
    const notify = vi.fn(async () => undefined)
    const badges: number[] = []
    const tick = (due: { id: string; note: string; due_at: string }[]) => processAlarmTick({
      due,
      newLeads: [],
      get: async (keys) => Object.fromEntries(keys.filter((key) => key in store).map((key) => [key, store[key]])),
      set: async (values) => { Object.assign(store, values) },
      notify,
      setBadge: async (count) => { badges.push(count) },
    })
    const due = [{ id: 'fu-due-1', note: 'Call Anjali', due_at: '2026-08-26T10:00:00Z' }]

    const first = await tick(due)
    const second = await tick(due)
    const third = await tick(due)
    await tick([])

    expect([first.followUps, second.followUps, third.followUps]).toEqual([['fu-due-1'], [], []])
    expect(notify).toHaveBeenCalledTimes(1)
    expect(store[NOTIFIED_FOLLOW_UPS_KEY]).toEqual(['fu-due-1'])
    expect(badges).toEqual([1, 1, 1, 0])
    console.info('three ticks: [fu-due-1], [], []; notifications=1; badges=1,1,1,0')
  })

  it('persists each dedupe id before a later notification failure', async () => {
    const store: Record<string, unknown> = {}
    const notify = vi.fn(async (id: string) => {
      if (id === 'follow-up:fu-2') throw new Error('notification backend failed')
    })
    await expect(processAlarmTick({
      due: [
        { id: 'fu-1', note: 'First', due_at: '2026-08-26T10:00:00Z' },
        { id: 'fu-2', note: 'Second', due_at: '2026-08-26T10:00:00Z' },
      ],
      newLeads: [],
      get: async (keys) => Object.fromEntries(keys.filter((key) => key in store).map((key) => [key, store[key]])),
      set: async (values) => { Object.assign(store, values) },
      notify,
      setBadge: async () => undefined,
    })).rejects.toThrow('notification backend failed')
    expect(store[NOTIFIED_FOLLOW_UPS_KEY]).toEqual(['fu-1'])
  })
})

describe('chat tab reuse', () => {
  beforeEach(() => vi.unstubAllGlobals())

  it('updates the stored tab for the second lead', async () => {
    const store = new Map<string, unknown>()
    let nextId = 73
    const tabs = {
      create: vi.fn(async () => ({ id: nextId })),
      get: vi.fn(async (id: number) => ({ id })),
      update: vi.fn(async () => ({})),
    }
    vi.stubGlobal('chrome', {
      storage: { local: {
        get: async (key: string) => store.has(key) ? { [key]: store.get(key) } : {},
        set: async (values: Record<string, unknown>) => { Object.entries(values).forEach(([key, value]) => store.set(key, value)) },
        remove: async (key: string) => { store.delete(key) },
      } },
      tabs,
    })

    const first = await openChatTab('https://wa.me/911111111111', 'wa_me')
    nextId = 74
    const second = await openChatTab('https://wa.me/922222222222', 'wa_me')

    expect(first).toBe(73)
    expect(second).toBe(73)
    expect(store.get(CHAT_TAB_KEY)).toBe(73)
    expect(tabs.create).toHaveBeenCalledTimes(1)
    expect(tabs.update).toHaveBeenCalledWith(73, { url: 'https://wa.me/922222222222', active: true })
    console.info(`tab reuse: first=${first}; second=${second}`)
  })
})
