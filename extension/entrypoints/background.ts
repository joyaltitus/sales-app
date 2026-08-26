import { defineBackground } from '#imports'
import { setSupabaseClient } from '@app/lib/supabase'
import { readDueFollowUps } from '@app/lib/leads-data'
import { readNewLeadNotifications } from '@app/lib/notifications-data'
import { processAlarmTick, openChatTab } from '../lib/background'
import { drainOutbox } from '../lib/outbox-store'
import { workerSupabase } from '../lib/worker-client'
import { AUTH_NEEDS_SIGNIN_KEY } from '../lib/storage'

const ALARM = 'rep.poll'
const POLL_MINUTES = 1

async function activeClientIds(userId: string): Promise<string[]> {
  const { data, error } = await workerSupabase
    .from('user_client_memberships')
    .select('client_id')
    .eq('user_id', userId)
  if (error) throw error
  return (data ?? []).map((row) => (row as { client_id: string }).client_id)
}

async function poll(): Promise<void> {
  const { data: sessionData, error: sessionError } = await workerSupabase.auth.getSession()
  if (sessionError || !sessionData.session) {
    await chrome.storage.local.set({ [AUTH_NEEDS_SIGNIN_KEY]: true })
    return
  }
  await chrome.storage.local.remove(AUTH_NEEDS_SIGNIN_KEY)
  const clientIds = await activeClientIds(sessionData.session.user.id)
  if (clientIds.length === 0) {
    await chrome.action.setBadgeText({ text: '' })
    return
  }

  const through = new Date(Date.now() + POLL_MINUTES * 60_000).toISOString()
  const [followUps, leadNotices] = await Promise.all([
    readDueFollowUps(clientIds, through),
    readNewLeadNotifications(clientIds),
  ])

  await processAlarmTick({
    due: followUps,
    newLeads: leadNotices,
    get: (keys) => chrome.storage.local.get(keys),
    set: (values) => chrome.storage.local.set(values),
    notify: async (id, title, message) => {
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
  await drainOutbox()
}

export default defineBackground(() => {
  setSupabaseClient(workerSupabase)
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
