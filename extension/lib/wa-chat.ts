/**
 * wa-chat — everything the panel DECIDES about the WhatsApp chat the rep has
 * open, as pure functions over a tiny snapshot.
 *
 * All DOM reaching lives in entrypoints/whatsapp.content.ts. Nothing here
 * touches `document`, so the rules that actually matter — which lead this chat
 * is, what a saved conversation looks like — stay testable when WhatsApp
 * reshuffles its markup, which it does without notice.
 *
 * Two limits are encoded here rather than left to a comment somewhere:
 *   · a GROUP chat yields null and is never matched, never saved, never read;
 *   · nothing in this file composes anything sendable. The panel puts text in
 *     the composer on a rep's click; the rep presses Enter.
 */
import { cleanPhoneForWhatsApp } from '../../src/lib/phone'
import { samePhone, type SearchableLead } from './search-leads'

/** The raw read of the open chat. Every field may be absent — WhatsApp paints
 *  the header before the message list, and a brand-new chat has no rows. */
export type ChatSnapshot = {
  /** Header title: the contact's name when the number is saved, the number itself when not. */
  title: string | null
  /** Chat jid lifted off a message row's data-id: "919876543210@c.us", "1203…@g.us". */
  jid: string | null
}

export type OpenChat = {
  displayName: string
  /** +E.164 when the jid gave us digits, else null — a name-only chat is still followable. */
  phoneE164: string | null
}

export type ChatMatch<T> =
  | { lead: T; how: 'phone' | 'name' | 'search' }
  | { lead: null; how: 'none' }

/** Groups, broadcast lists and channels — everything that is not one person. */
function isGroupJid(jid: string): boolean {
  return jid.endsWith('@g.us') || jid.endsWith('@broadcast') || jid.endsWith('@newsletter')
}

function jidDigits(jid: string): string {
  return (jid.split('@')[0] ?? '').replace(/[^0-9]/g, '')
}

/**
 * Turn a snapshot into the chat the panel should follow, or null.
 *
 * Null means: a group / broadcast / channel, or no chat open. The group case is
 * dropped BEFORE any matching or saving — reading a group pulls in third
 * parties who never contacted this business, which is exactly the consent
 * problem the DPDP Act cares about, and the rep is the accountable party.
 */
export function parseChat(snapshot: ChatSnapshot): OpenChat | null {
  const jid = snapshot.jid?.trim() ?? ''
  if (jid && isGroupJid(jid)) return null

  const title = snapshot.title?.trim() ?? ''
  const fromJid = jid ? jidDigits(jid) : ''
  // The title is only trusted as a number when it carries no letters: "Anjali
  // (work)" must never read as a phone just because it contains digits.
  const fromTitle = /\p{L}/u.test(title) ? '' : cleanPhoneForWhatsApp(title)
  const digits = fromJid || fromTitle

  if (!title && !digits) return null
  return {
    displayName: title || `+${digits}`,
    phoneE164: digits ? `+${digits}` : null,
  }
}

function fold(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase()
}

/**
 * Match the open chat to a lead the rep already has: phone first (the only
 * identifier WhatsApp and the CRM genuinely share), then an exact folded name,
 * then a loose name contains-match that must land on exactly ONE lead to count.
 *
 * An ambiguous name hit is deliberately "no match". Opening the wrong lead
 * beside a live chat is worse than showing the rep a Save-as-lead card, because
 * the wrong lead is where the next outcome, note and follow-up would land.
 */
export function matchChat<T extends SearchableLead>(chat: OpenChat, leads: T[]): ChatMatch<T> {
  if (chat.phoneE164) {
    const byPhone = leads.find((lead) => samePhone(lead.phone_e164, chat.phoneE164))
    if (byPhone) return { lead: byPhone, how: 'phone' }
  }

  const wanted = fold(chat.displayName)
  if (wanted) {
    const exact = leads.filter((lead) => fold(lead.display_name) === wanted)
    if (exact.length === 1) return { lead: exact[0] as T, how: 'name' }

    const loose = leads.filter((lead) => fold(lead.display_name).includes(wanted))
    if (loose.length === 1) return { lead: loose[0] as T, how: 'search' }
  }

  return { lead: null, how: 'none' }
}

// ── The visible conversation ─────────────────────────────────────────────────

export type ChatMessage = {
  /** Stable within one read; the review list's React key and checkbox id. */
  id: string
  direction: 'in' | 'out'
  /** Body text. Empty for a voice note — `voice` carries what we know instead. */
  text: string
  /** "0:42" when this row is a voice note, else null. */
  voice: string | null
  /**
   * WhatsApp's own stamp, verbatim ("8:42 pm, 02/09/2026"). Deliberately never
   * re-parsed into a Date: the format follows the rep's locale, and a wrong date
   * written into the CRM is worse than a stamp a human can read. The note row's
   * own created_at is the machine-readable truth.
   */
  at: string | null
  author: string | null
}

const PRE_PLAIN = /^\[([^\]]+)]\s*(.*?):\s*$/

/** Split `data-pre-plain-text="[8:42 pm, 02/09/2026] Anjali: "` into its parts. */
export function parsePrePlainText(value: string | null | undefined): {
  at: string | null
  author: string | null
} {
  const match = PRE_PLAIN.exec((value ?? '').trim())
  if (!match) return { at: null, author: null }
  return { at: (match[1] ?? '').trim() || null, author: (match[2] ?? '').trim() || null }
}

export function describeMessage(message: ChatMessage): string {
  const arrow = message.direction === 'in' ? '←' : '→'
  return `${arrow} ${message.voice ? `[voice note, ${message.voice}]` : message.text}`
}

/**
 * The ONE conversation_notes body a "Save conversation" confirm writes.
 *
 * Exactly what the review list showed the rep, in the order it showed it, with
 * the range spelled out at the top: the screen is the receipt. Nothing is
 * summarised, inferred or added — a note the rep did not read is a note the rep
 * cannot stand behind.
 */
export function noteFromMessages(messages: ChatMessage[], chatName: string): string {
  const stamps = messages.map((message) => message.at).filter((at): at is string => !!at)
  const first = stamps[0]
  const last = stamps[stamps.length - 1]
  const range = !first ? '' : first === last ? ` — ${first}` : ` — ${first} → ${last}`
  const count = `${messages.length} message${messages.length === 1 ? '' : 's'}`
  return [
    `WhatsApp chat with ${chatName}${range} (${count})`,
    'Saved from WhatsApp Web by the rep.',
    '',
    ...messages.map(describeMessage),
  ].join('\n')
}
