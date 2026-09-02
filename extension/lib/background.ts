import type { ChatMode } from './contracts'

export const NOTIFIED_FOLLOW_UPS_KEY = 'rep.notifiedFollowUps'
export const NOTIFIED_NEW_LEADS_KEY = 'rep.notifiedNewLeads'

export type DueFollowUp = { id: string; note: string; due_at: string }
export type NewLeadNotice = { id: string; title: string; body: string | null }

type TickDeps = {
  due: DueFollowUp[]
  newLeads: NewLeadNotice[]
  get: (keys: string[]) => Promise<Record<string, unknown>>
  set: (values: Record<string, unknown>) => Promise<void>
  notify: (id: string, title: string, message: string) => Promise<void>
  setBadge: (count: number) => Promise<void>
}

/** Purely orchestrates one tick; persisted IDs make repeated ticks harmless. */
export async function processAlarmTick(deps: TickDeps): Promise<{ followUps: string[]; newLeads: string[] }> {
  const stored = await deps.get([NOTIFIED_FOLLOW_UPS_KEY, NOTIFIED_NEW_LEADS_KEY])
  const followUpIds = new Set(Array.isArray(stored[NOTIFIED_FOLLOW_UPS_KEY]) ? stored[NOTIFIED_FOLLOW_UPS_KEY] as string[] : [])
  const newLeadIds = new Set(Array.isArray(stored[NOTIFIED_NEW_LEADS_KEY]) ? stored[NOTIFIED_NEW_LEADS_KEY] as string[] : [])
  const emitted = { followUps: [] as string[], newLeads: [] as string[] }

  await deps.setBadge(deps.due.length)

  for (const item of deps.due) {
    if (followUpIds.has(item.id)) continue
    await deps.notify(`follow-up:${item.id}`, 'Follow-up due', item.note || 'A follow-up is due now.')
    followUpIds.add(item.id)
    emitted.followUps.push(item.id)
    await deps.set({ [NOTIFIED_FOLLOW_UPS_KEY]: [...followUpIds].slice(-500) })
  }
  for (const item of deps.newLeads) {
    if (newLeadIds.has(item.id)) continue
    await deps.notify(`new-lead:${item.id}`, item.title, item.body ?? 'A new lead needs attention.')
    newLeadIds.add(item.id)
    emitted.newLeads.push(item.id)
    await deps.set({ [NOTIFIED_NEW_LEADS_KEY]: [...newLeadIds].slice(-500) })
  }
  return emitted
}

export async function openChatTab(url: string, mode: ChatMode): Promise<number | null> {
  if (mode === 'desktop') {
    await chrome.tabs.update({ url })
    return null
  }

  const [existing] = await chrome.tabs.query({ url: '*://web.whatsapp.com/*' })
  if (existing?.id !== undefined) {
    await chrome.tabs.update(existing.id, { url, active: true })
    await chrome.windows.update(existing.windowId, { focused: true })
    return existing.id
  }

  const tab = await chrome.tabs.create({ url, active: true })
  if (tab.id === undefined) throw new Error('Chrome created a chat tab without an id')
  return tab.id
}

export const CALL_TAB_KEY = 'rep.callTabId'

/**
 * Open — or re-focus — the ONE full-tab call HUD.
 *
 * Reuse is the whole point: a rep who clicks this on six leads in a row must
 * end with one tab, not six. The stored id is a hint, never a promise — the rep
 * may have closed the tab, and Chrome rejects an update to a dead id — so a
 * miss falls through to create instead of throwing (a throw here would leave
 * the rep with no HUD at all, mid-call, which is the worst possible moment).
 */
export async function openCallTab(): Promise<number> {
  const url = chrome.runtime.getURL('/call.html')
  const stored = await chrome.storage.session.get(CALL_TAB_KEY)
  const known = stored[CALL_TAB_KEY]

  if (typeof known === 'number') {
    try {
      const tab = await chrome.tabs.get(known)
      if (tab.id !== undefined) {
        await chrome.tabs.update(tab.id, { active: true })
        await chrome.windows.update(tab.windowId, { focused: true })
        return tab.id
      }
    } catch {
      // Closed since we stored it. Fall through and make a new one.
    }
  }

  const tab = await chrome.tabs.create({ url, active: true })
  if (tab.id === undefined) throw new Error('Chrome created a call tab without an id')
  await chrome.storage.session.set({ [CALL_TAB_KEY]: tab.id })
  return tab.id
}
