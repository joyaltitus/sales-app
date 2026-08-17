/**
 * Phone number and WhatsApp URL helpers for Indian sales operations.
 */

/** Strip symbols, WhatsApp JID suffixes, and format as clean digits for wa.me URL. */
export function cleanPhoneForWhatsApp(raw: string | null | undefined): string {
  if (!raw) return ''
  // Remove whatsapp JID suffix if present (e.g. 919947638424@c.us or @s.whatsapp.net)
  const cleaned = raw.split('@')[0].replace(/\D/g, '')
  if (!cleaned) return ''

  // Standard Indian 10-digit mobile number -> prefix with 91
  if (cleaned.length === 10) {
    return `91${cleaned}`
  }
  return cleaned
}

/**
 * Format raw phone number into standard Indian readable grouping:
 * 919947638424 -> +91 99476 38424
 * 9947638424 -> +91 99476 38424
 */
export function formatPhone(raw: string | null | undefined): string {
  if (!raw) return ''
  const digits = cleanPhoneForWhatsApp(raw)

  if (digits.length === 12 && digits.startsWith('91')) {
    const mobile = digits.slice(2)
    return `+91 ${mobile.slice(0, 5)} ${mobile.slice(5)}`
  }

  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`
  }

  // Handle WhatsApp JID if raw carried one
  if (raw.includes('@c.us') || raw.includes('@s.whatsapp.net')) {
    return `+${digits}`
  }

  return raw
}

/** Build official WhatsApp Click-to-Chat URL. */
export function getWhatsAppUrl(phone: string | null | undefined, text?: string): string | null {
  const digits = cleanPhoneForWhatsApp(phone)
  if (!digits) return null
  const encodedText = text ? `?text=${encodeURIComponent(text)}` : ''
  return `https://wa.me/${digits}${encodedText}`
}
