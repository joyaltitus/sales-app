import type { SupportedStorage } from '@supabase/supabase-js'

export const AUTH_NEEDS_SIGNIN_KEY = 'rep.authNeedsSignin'

/** Supabase Auth storage shared by every extension context. */
export const chromeStorage: SupportedStorage = {
  async getItem(key) {
    const stored = await chrome.storage.local.get(key)
    return typeof stored[key] === 'string' ? stored[key] : null
  },
  async setItem(key, value) {
    await chrome.storage.local.set({ [key]: value })
  },
  async removeItem(key) {
    await chrome.storage.local.remove(key)
  },
}
