import { cleanPhoneForWhatsApp } from './phone'

/**
 * lead-fields — the shape of "a new lead", in ONE place.
 *
 * The web AddLeadModal and the extension's Add-lead card are two front doors to
 * the same `create_manual_lead` RPC. When their option lists lived only in the
 * modal, the extension had to either import a React modal to read a constant or
 * retype the list — and a retyped list drifts, which shows up as two surfaces
 * disagreeing about what a valid source is.
 */

/** `leads.source` is fixed at 'manual' by the RPC; this is `contacts.channel`. */
export const CHANNELS = [
  { value: 'phone', label: 'Phone Call' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'walkin', label: 'Walk-in / In-person' },
  { value: 'referral', label: 'Referral' },
  { value: 'website', label: 'Website inquiry' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'email', label: 'Email' },
] as const

export const VALUE_PRESETS = [
  { label: '₹25K', value: 25000 },
  { label: '₹50K', value: 50000 },
  { label: '₹60K', value: 60000 },
  { label: '₹1L', value: 100000 },
  { label: '₹1.5L', value: 150000 },
] as const

/** India-first: reps type the last ten digits and expect the rest to be there. */
export const PHONE_PREFIX = '+91'

/**
 * Whether a phone field holds an actual number rather than just the prefix.
 *
 * Prefilling '+91' means the box is never empty, so `phone.trim()` — which is
 * what the web modal gates its submit on — would call a bare prefix valid.
 * `create_manual_lead` would then take '91' as the contact identifier and mint a
 * junk contact that looks real. This is the gate that stops that.
 */
export function hasDialableDigits(phone: string): boolean {
  return cleanPhoneForWhatsApp(phone).replace(/^91/, '').length >= 6
}

/** '' → '+91'; anything the rep or WhatsApp already supplied is left alone. */
export function withPhonePrefix(phone: string): string {
  return phone.trim() ? phone : PHONE_PREFIX
}
