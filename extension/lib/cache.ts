import type { Cached, LeadDetail, QueueItem, Rebuttal, Snippet } from './contracts'
import type { LibraryScript } from '@app/lib/scripts-data'
import type { ObjectionTaxonomyRow } from '@app/lib/objections-data'
import type { TargetItem } from '@app/lib/targets-data'

export const CACHE_KEYS = {
  queue: 'rep.cache.queue',
  leadDetails: 'rep.cache.leadDetails',
  snippets: 'rep.cache.snippets',
  library: 'rep.cache.library',
  target: 'rep.cache.target',
} as const

export type ExtensionCache = {
  [CACHE_KEYS.queue]: Cached<QueueItem[]>
  [CACHE_KEYS.leadDetails]: Cached<LeadDetail>[]
  [CACHE_KEYS.snippets]: Cached<Snippet[]>
  [CACHE_KEYS.library]: Cached<{
    scripts: LibraryScript[]
    taxonomy: ObjectionTaxonomyRow[]
    rebuttals: Rebuttal[]
  }>
  [CACHE_KEYS.target]: Cached<TargetItem | null>
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

export async function clearLeadDetails(): Promise<void> {
  await chrome.storage.local.remove(CACHE_KEYS.leadDetails)
}

export function cached<T>(data: T, now = new Date()): Cached<T> {
  return { data, fetched_at: now.toISOString() }
}

export const cacheQueue = (value: ExtensionCache[typeof CACHE_KEYS.queue]) => writeCache(CACHE_KEYS.queue, value)
export const cacheSnippets = (value: ExtensionCache[typeof CACHE_KEYS.snippets]) => writeCache(CACHE_KEYS.snippets, value)
export const cacheLibrary = (value: ExtensionCache[typeof CACHE_KEYS.library]) => writeCache(CACHE_KEYS.library, value)
export const cacheTarget = (value: ExtensionCache[typeof CACHE_KEYS.target]) => writeCache(CACHE_KEYS.target, value)
