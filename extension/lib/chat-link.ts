/**
 * chatLink — the one place that turns a stored phone into a chat URL.
 *
 * The extension OPENS chats; it never reads them. WhatsApp Web in one reused
 * tab is the default; whatsapp://send is a per-rep speed setting. Normalization is
 * delegated to cleanPhoneForWhatsApp (src/lib/phone) — digits only, no +,
 * no spaces, no dashes. A null or unparseable number yields null, never a
 * broken URL.
 */
import { cleanPhoneForWhatsApp, getWhatsAppUrl } from '../../src/lib/phone'
import type { ChatMode } from './contracts'

export function chatLink(phoneE164: string | null | undefined, mode: ChatMode): string | null {
  if (mode === 'desktop') {
    const digits = cleanPhoneForWhatsApp(phoneE164)
    return digits ? `whatsapp://send?phone=${digits}` : null
  }
  return getWhatsAppUrl(phoneE164)
}
