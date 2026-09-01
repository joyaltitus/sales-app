import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
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

  it('navigates an open WhatsApp Web tab and focuses its window', async () => {
    const tabs = {
      query: vi.fn(async () => [{ id: 73, windowId: 9 }]),
      create: vi.fn(async () => ({ id: 74 })),
      update: vi.fn(async () => ({})),
    }
    const windows = { update: vi.fn(async () => ({})) }
    vi.stubGlobal('chrome', {
      tabs,
      windows,
    })

    const result = await openChatTab('https://web.whatsapp.com/send?phone=911111111111', 'wa_me')

    expect(result).toBe(73)
    expect(tabs.query).toHaveBeenCalledWith({ url: '*://web.whatsapp.com/*' })
    expect(tabs.update).toHaveBeenCalledWith(73, {
      url: 'https://web.whatsapp.com/send?phone=911111111111',
      active: true,
    })
    expect(windows.update).toHaveBeenCalledWith(9, { focused: true })
    expect(tabs.create).not.toHaveBeenCalled()
  })

  it('creates an active tab when WhatsApp Web is not already open', async () => {
    const tabs = {
      query: vi.fn(async () => []),
      create: vi.fn(async () => ({ id: 74 })),
      update: vi.fn(async () => ({})),
    }
    const windows = { update: vi.fn(async () => ({})) }
    vi.stubGlobal('chrome', { tabs, windows })

    const result = await openChatTab('https://web.whatsapp.com/send?phone=922222222222', 'wa_me')

    expect(result).toBe(74)
    expect(tabs.create).toHaveBeenCalledWith({
      url: 'https://web.whatsapp.com/send?phone=922222222222',
      active: true,
    })
    expect(tabs.update).not.toHaveBeenCalled()
    expect(windows.update).not.toHaveBeenCalled()
  })

  it('keeps desktop mode as an explicit protocol handoff', async () => {
    const tabs = {
      query: vi.fn(async () => []),
      create: vi.fn(async () => ({ id: 74 })),
      update: vi.fn(async () => ({})),
    }
    vi.stubGlobal('chrome', { tabs })

    const result = await openChatTab('whatsapp://send?phone=933333333333', 'desktop')

    expect(result).toBeNull()
    expect(tabs.update).toHaveBeenCalledWith({ url: 'whatsapp://send?phone=933333333333' })
    expect(tabs.query).not.toHaveBeenCalled()
    expect(tabs.create).not.toHaveBeenCalled()
  })
})
