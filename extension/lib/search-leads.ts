/**
 * searchLeads — filter the queue/book by name or phone.
 *
 * Phone matching delegates to cleanPhoneForWhatsApp in src/lib/phone (the one
 * normalizer; this module must not grow a second one). Because that helper
 * prefixes a leading 10-digit Indian number with 91, matching is done on the
 * digit SUFFIX so +91…/91…/0…/bare-10-digit queries all land on one contact.
 * Name matching is case- and diacritic-insensitive via Unicode folding.
 */
import { cleanPhoneForWhatsApp } from '../../src/lib/phone'

export type SearchableLead = {
  display_name: string
  phone_e164: string | null
}

function foldText(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

/** Digits of a stored phone, trunk-prefix zeros dropped. */
function contactDigits(phone: string | null): string {
  return cleanPhoneForWhatsApp(phone).replace(/^0+/, '')
}

/** Digits of a raw query like "+919876543210", "09876543210" or "98765 43210". */
function queryDigits(query: string): string {
  return cleanPhoneForWhatsApp(query).replace(/^0+/, '')
}

/** Suffix comparison of two already-normalized digit strings. */
function digitsMatch(own: string, other: string): boolean {
  if (!own || !other) return false
  return own === other || own.endsWith(other) || other.endsWith(own)
}

/**
 * Whether two raw phone strings name the same person, in the one place that
 * decides it. wa-chat's chat-to-lead match reuses this rather than growing a
 * second normalizer: the WhatsApp jid gives bare digits, the CRM stores
 * +E.164, and a mismatch between those two rules would silently open the
 * wrong lead beside a live chat.
 */
export function samePhone(a: string | null | undefined, b: string | null | undefined): boolean {
  return digitsMatch(contactDigits(a ?? null), contactDigits(b ?? null))
}

function matches(lead: SearchableLead, foldedQuery: string, digits: string): boolean {
  if (foldedQuery && foldText(lead.display_name).includes(foldedQuery)) return true
  if (!digits) return false
  return digitsMatch(contactDigits(lead.phone_e164), digits)
}

/**
 * Filter `items` by `query`. An empty or whitespace-only query returns the
 * input array itself, unchanged — never an empty list. Never mutates anything.
 */
export function searchLeads<T extends SearchableLead>(items: T[], query: string): T[] {
  const trimmed = query.trim()
  if (!trimmed) return items
  const foldedQuery = foldText(trimmed)
  const digits = queryDigits(trimmed)
  if (!foldedQuery && !digits) return items
  return items.filter((lead) => matches(lead, foldedQuery, digits))
}
