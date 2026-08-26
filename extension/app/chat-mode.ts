import type { ChatMode } from '../lib/contracts'

export const CHAT_MODE_KEY = 'rep.chatMode'
export const DEFAULT_CHAT_MODE: ChatMode = 'wa_me'

export async function loadChatMode(): Promise<ChatMode> {
  const stored = await chrome.storage.local.get(CHAT_MODE_KEY)
  return stored[CHAT_MODE_KEY] === 'desktop' ? 'desktop' : DEFAULT_CHAT_MODE
}

export async function saveChatMode(mode: ChatMode): Promise<void> {
  await chrome.storage.local.set({ [CHAT_MODE_KEY]: mode })
}
