import type { Cached, LeadDetail, QueueItem, Rebuttal } from './contracts'
import type { LibraryScript } from '@app/lib/scripts-data'
import type { ObjectionTaxonomyRow } from '@app/lib/objections-data'

export const CACHE_KEYS = {
  queue: 'rep.cache.queue',
  leadDetails: 'rep.cache.leadDetails',
  library: 'rep.cache.library',
} as const

export type ExtensionCache = {
  [CACHE_KEYS.queue]: Cached<QueueItem[]>
  [CACHE_KEYS.leadDetails]: Cached<LeadDetail>[]
  [CACHE_KEYS.library]: Cached<{
    scripts: LibraryScript[]
    taxonomy: ObjectionTaxonomyRow[]
    rebuttals: Rebuttal[]
  }>
}

export async function readCache<K extends keyof ExtensionCache>(key: K): Promise<ExtensionCache[K] | null> {
  const stored = await chrome.storage.local.get(key)
  return (stored[key] as ExtensionCache[K] | undefined) ?? null
}

export async function writeCache<K extends keyof ExtensionCache>(key: K, value: ExtensionCache[K]): Promise<void> {
  await chrome.storage.local.set({ [key]: value })
}

/** Keep the most recently opened detail first and cap the cache at 20 leads. */
export async function cacheLeadDetail(value: Cached<LeadDetail>): Promise<void> {
  const current = (await readCache(CACHE_KEYS.leadDetails)) ?? []
  const next = [value, ...current.filter((item) => item.data.lead.lead_id !== value.data.lead.lead_id)].slice(0, 20)
  await writeCache(CACHE_KEYS.leadDetails, next)
}

export async function clearPanelCaches(): Promise<void> {
  await chrome.storage.local.remove(Object.values(CACHE_KEYS))
}

export function cached<T>(data: T, now = new Date(), scope?: string): Cached<T> {
  return { data, fetched_at: now.toISOString(), ...(scope ? { scope } : {}) }
}

export const cacheQueue = (value: ExtensionCache[typeof CACHE_KEYS.queue]) => writeCache(CACHE_KEYS.queue, value)
export const cacheLibrary = (value: ExtensionCache[typeof CACHE_KEYS.library]) => writeCache(CACHE_KEYS.library, value)
