import { afterEach, expect, it, vi } from 'vitest'
import { CHAT_MODE_KEY, DEFAULT_CHAT_MODE, loadChatMode, saveChatMode } from './chat-mode'

function fakeStorage() {
  const store = new Map<string, unknown>()
  return {
    store,
    chrome: {
      local: {
        get: vi.fn(async (key: string) =>
          store.has(key) ? { [key]: store.get(key) } : {},
        ),
        set: vi.fn(async (entries: Record<string, unknown>) => {
          for (const [key, value] of Object.entries(entries)) store.set(key, value)
        }),
      },
    },
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

it('persists the chat mode across closing and reopening the panel', async () => {
  const { store, chrome } = fakeStorage()
  vi.stubGlobal('chrome', chrome)

  await expect(loadChatMode()).resolves.toBe(DEFAULT_CHAT_MODE)

  await saveChatMode('desktop')
  expect(store.get(CHAT_MODE_KEY)).toBe('desktop')

  await expect(loadChatMode()).resolves.toBe('desktop')

  await saveChatMode('wa_me')
  await expect(loadChatMode()).resolves.toBe('wa_me')
})
