import { defineBackground } from '#imports'
import { processAlarmTick, openChatTab } from '../lib/background'
import { isQuietAt, loadPrefs } from '../lib/prefs'
import { AUTH_NEEDS_SIGNIN_KEY } from '../lib/storage'
import { getWorkerSession, hasStoredSession, readWorkerNotices } from '../lib/worker-api'

const ALARM = 'rep.poll'
export const POLL_MINUTES = 3

async function poll(): Promise<void> {
  const session = await getWorkerSession()
  if (!session) {
    // A fresh install has no token yet; that is "sign in", not "sign in again".
    if (await hasStoredSession()) await chrome.storage.local.set({ [AUTH_NEEDS_SIGNIN_KEY]: true })
    return
  }
  await chrome.storage.local.remove(AUTH_NEEDS_SIGNIN_KEY)
  const through = new Date(Date.now() + POLL_MINUTES * 60_000).toISOString()
  const { due, newLeads } = await readWorkerNotices(session, through)

  // Quiet hours gate the NOTIFICATION, never the badge or the ledger: a rep who
  // set 21:00–09:00 wants to stop being pinged at dinner, not to lose the count
  // of what is waiting. processAlarmTick still records every id as seen, so a
  // follow-up that came due at 22:00 does not re-fire the moment quiet ends.
  const prefs = await loadPrefs()
  const quiet = isQuietAt(prefs, new Date())

  await processAlarmTick({
    due,
    newLeads,
    get: (keys) => chrome.storage.local.get(keys),
    set: (values) => chrome.storage.local.set(values),
    notify: async (id, title, message) => {
      if (quiet) return
      await chrome.notifications.create(id, {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('/icons/icon-192.png'),
        title,
        message,
      })
    },
    setBadge: async (count) => {
      await chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' })
      await chrome.action.setBadgeBackgroundColor({ color: '#c2410c' })
    },
  })
}

export default defineBackground(() => {
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  void chrome.alarms.create(ALARM, { periodInMinutes: POLL_MINUTES })
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM) void poll()
  })
  chrome.runtime.onInstalled.addListener(() => void poll())
  chrome.runtime.onStartup.addListener(() => void poll())
  chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    const request = message as { type?: string; url?: string; mode?: 'wa_me' | 'desktop' }
    if (request.type !== 'rep.openChat' || !request.url || !request.mode) return
    void openChatTab(request.url, request.mode).then(sendResponse, (error: unknown) => {
      sendResponse({ error: error instanceof Error ? error.message : String(error) })
    })
    return true
  })
})
