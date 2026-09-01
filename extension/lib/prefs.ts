import type { ChatMode } from './contracts'

/**
 * prefs — the rep's own settings, in one place.
 *
 * Two stores, on purpose:
 *   · chrome.storage.local for machine-shaped choices (chat mode, workspace,
 *     quiet hours) — a rep's work laptop and their home machine can differ.
 *   · chrome.storage.sync for the snippet library, which is the one thing a rep
 *     would be annoyed to retype after a reinstall.
 *
 * `loadChatMode`/`saveChatMode` stay in app/chat-mode.ts under their existing
 * key; moving them would silently reset every installed rep's choice.
 */

export const PREFS_KEY = 'rep.prefs'
export const SNIPPETS_KEY = 'rep.snippets'

export const MAX_SNIPPETS = 20
export const MAX_SNIPPET_CHARS = 500

export type Prefs = {
  /** Whether the panel follows the open WhatsApp chat by default on open. */
  followChat: boolean
  /** Local "HH:MM"; notifications are held between these two. Equal = never quiet. */
  quietFrom: string
  quietTo: string
  /** Chosen workspace when the rep belongs to more than one client. */
  activeClientId: string | null
}

export const DEFAULT_PREFS: Prefs = {
  followChat: true,
  quietFrom: '21:00',
  quietTo: '09:00',
  activeClientId: null,
}

export async function loadPrefs(): Promise<Prefs> {
  const stored = (await chrome.storage.local.get(PREFS_KEY))[PREFS_KEY]
  return { ...DEFAULT_PREFS, ...(stored as Partial<Prefs> | undefined) }
}

export async function savePrefs(patch: Partial<Prefs>): Promise<Prefs> {
  const next = { ...(await loadPrefs()), ...patch }
  await chrome.storage.local.set({ [PREFS_KEY]: next })
  return next
}

/** Minutes since midnight, or null when the value is not "HH:MM". */
function minutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return null
  const h = Number(match[1])
  const m = Number(match[2])
  if (h > 23 || m > 59) return null
  return h * 60 + m
}

/**
 * Whether notifications are muted at `now`.
 *
 * Windows that cross midnight (21:00 → 09:00) are the normal case for a quiet
 * period, so the comparison flips rather than assuming from < to. Equal
 * endpoints mean "no quiet hours", never "quiet all day" — a setting that
 * silences everything by accident is worse than one that silences nothing.
 */
export function isQuietAt(prefs: Pick<Prefs, 'quietFrom' | 'quietTo'>, now: Date): boolean {
  const from = minutes(prefs.quietFrom)
  const to = minutes(prefs.quietTo)
  if (from === null || to === null || from === to) return false
  const at = now.getHours() * 60 + now.getMinutes()
  return from < to ? at >= from && at < to : at >= from || at < to
}

// ── Per-rep snippets ─────────────────────────────────────────────────────────

export type SavedSnippet = { id: string; title: string; body: string }

export async function loadSnippets(): Promise<SavedSnippet[]> {
  const stored = (await chrome.storage.sync.get(SNIPPETS_KEY))[SNIPPETS_KEY]
  return Array.isArray(stored) ? (stored as SavedSnippet[]) : []
}

/**
 * Add one snippet, or report why it was refused.
 *
 * The caps are chrome.storage.sync's, made visible: the area holds ~8 KB per
 * item and 100 KB total, so a rep who pastes a whole script in would otherwise
 * hit a silent quota error at write time and lose the lot.
 */
export async function addSnippet(
  title: string,
  body: string,
): Promise<{ ok: true; snippets: SavedSnippet[] } | { ok: false; message: string }> {
  const cleanTitle = title.trim()
  const cleanBody = body.trim()
  if (!cleanTitle || !cleanBody) return { ok: false, message: 'Give the snippet a name and some text.' }
  if (cleanBody.length > MAX_SNIPPET_CHARS) {
    return { ok: false, message: `Snippets are capped at ${MAX_SNIPPET_CHARS} characters.` }
  }
  const current = await loadSnippets()
  if (current.length >= MAX_SNIPPETS) {
    return { ok: false, message: `You already have ${MAX_SNIPPETS} snippets. Delete one first.` }
  }
  const snippets = [...current, { id: crypto.randomUUID(), title: cleanTitle, body: cleanBody }]
  await chrome.storage.sync.set({ [SNIPPETS_KEY]: snippets })
  return { ok: true, snippets }
}

export async function removeSnippet(id: string): Promise<SavedSnippet[]> {
  const snippets = (await loadSnippets()).filter((snippet) => snippet.id !== id)
  await chrome.storage.sync.set({ [SNIPPETS_KEY]: snippets })
  return snippets
}

export type { ChatMode }
