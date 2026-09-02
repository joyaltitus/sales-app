import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CALL_TAB_KEY,
  NOTIFIED_FOLLOW_UPS_KEY,
  openCallTab,
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

describe('call tab reuse', () => {
  function chromeWith(session: Record<string, unknown>, tabsOver: Record<string, unknown> = {}) {
    const store = { ...session }
    const tabs = {
      get: vi.fn(async (id: number) => ({ id, windowId: 5 })),
      create: vi.fn(async () => ({ id: 91 })),
      update: vi.fn(async () => ({})),
      ...tabsOver,
    }
    const windows = { update: vi.fn(async () => ({})) }
    vi.stubGlobal('chrome', {
      tabs,
      windows,
      runtime: { getURL: (path: string) => `chrome-extension://abc${path}` },
      storage: {
        session: {
          get: vi.fn(async (key: string) => (key in store ? { [key]: store[key] } : {})),
          set: vi.fn(async (values: Record<string, unknown>) => { Object.assign(store, values) }),
        },
      },
    })
    return { tabs, windows, store }
  }

  it('AT-01/AT-02: creates the call tab once, then focuses that same tab', async () => {
    const first = chromeWith({})
    const created = await openCallTab()
    expect(created).toBe(91)
    expect(first.tabs.create).toHaveBeenCalledWith({ url: 'chrome-extension://abc/call.html', active: true })
    expect(first.store[CALL_TAB_KEY]).toBe(91)

    // Second click, with the id now remembered: focus, never a second tab.
    const second = chromeWith({ [CALL_TAB_KEY]: 91 })
    const again = await openCallTab()
    expect(again).toBe(91)
    expect(second.tabs.create).not.toHaveBeenCalled()
    expect(second.tabs.update).toHaveBeenCalledWith(91, { active: true })
    expect(second.windows.update).toHaveBeenCalledWith(5, { focused: true })
  })

  it('AT-03: a remembered tab the rep closed falls through to a new one instead of throwing', async () => {
    const { tabs } = chromeWith(
      { [CALL_TAB_KEY]: 404 },
      { get: vi.fn(async () => { throw new Error('No tab with id: 404.') }) },
    )
    await expect(openCallTab()).resolves.toBe(91)
    expect(tabs.create).toHaveBeenCalledOnce()
  })
})
