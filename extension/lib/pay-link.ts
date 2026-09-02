/**
 * pay-link — the token ask and the callback confirmation.
 *
 * WhatsApp does NOT linkify `upi://` on most phones: the customer sees dead
 * grey text and asks what to do with it. So the message the rep inserts carries
 * `{{pay.url}}` (a real https link, tappable everywhere) and the UPI id as plain
 * text they can copy. The `upi://` intent built here backs ONE thing — the
 * panel's own "Open in UPI app" button, on the rep's own phone-linked desktop.
 */
import { amountOf } from './course-vars'
import type { CourseItem, SalesConfig } from './contracts'

/** The seat token to ask for: the course's own amount wins over the workspace default. */
export function tokenAmount(config: SalesConfig | null | undefined, item: CourseItem | null | undefined): number | null {
  return amountOf(item?.sales_facts?.token_amount) ?? amountOf(config?.token_amount)
}

export function payVars(
  config: SalesConfig | null | undefined,
  item: CourseItem | null | undefined,
): Record<string, string> {
  const out: Record<string, string> = {}
  const amount = tokenAmount(config, item)
  if (amount !== null) out['pay.amount'] = new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(amount)
  if (config?.upi_vpa) out['pay.upi'] = config.upi_vpa
  if (config?.upi_payee) out['pay.payee'] = config.upi_payee
  if (config?.pay_url) out['pay.url'] = config.pay_url
  return out
}

/** Can the rep ask for money at all? A UPI id or a pay page — either is enough. */
export function canCollect(config: SalesConfig | null | undefined): boolean {
  return Boolean(config?.upi_vpa || config?.pay_url)
}

const enc = (value: string) => encodeURIComponent(value).replace(/%20/g, '%20')

/**
 * `upi://pay?pa=&pn=&am=&cu=INR&tn=` — hand-encoded rather than via
 * URLSearchParams, which writes `+` for a space. Some UPI apps take the `+`
 * literally and the payee name comes out as "Bright+Academy".
 */
export function buildUpiIntent(
  config: SalesConfig | null | undefined,
  amount: number | null,
  note?: string | null,
): string | null {
  if (!config?.upi_vpa) return null
  const parts = [`pa=${enc(config.upi_vpa)}`]
  if (config.upi_payee) parts.push(`pn=${enc(config.upi_payee)}`)
  if (amount !== null) parts.push(`am=${enc(String(amount))}`)
  parts.push('cu=INR')
  if (note) parts.push(`tn=${enc(note)}`)
  return `upi://pay?${parts.join('&')}`
}

const DEFAULT_TZ = 'Asia/Kolkata'

/** YYYY-MM-DD as seen in `timezone` (en-CA formats that way by default). */
function dayIn(at: Date, timezone: string): string {
  return at.toLocaleDateString('en-CA', { timeZone: timezone })
}

/**
 * "tomorrow 5:00 pm" / "Fri 4:00 pm", in the CLIENT's timezone — a rep on a
 * laptop still set to UTC must not confirm a callback an hour off.
 * Null when the date is unusable, so the caller can refuse to insert a text
 * with a blank in it.
 */
export function callbackWhen(
  dateIso: string | null | undefined,
  timezone: string | null | undefined = DEFAULT_TZ,
  now: Date = new Date(),
): string | null {
  if (!dateIso) return null
  const at = new Date(dateIso)
  if (Number.isNaN(at.getTime())) return null
  const tz = timezone || DEFAULT_TZ
  let time: string
  let day: string
  let weekday: string
  try {
    time = at.toLocaleTimeString('en-IN', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true })
    day = dayIn(at, tz)
    weekday = at.toLocaleDateString('en-IN', { timeZone: tz, weekday: 'short' })
  } catch {
    return null
  }
  // Narrow no-break space is what ICU puts before am/pm; it survives copy-paste
  // into WhatsApp as an invisible character nobody can delete.
  time = time.replace(/[  ]/g, ' ').toLowerCase()
  const today = dayIn(now, tz)
  const tomorrow = dayIn(new Date(now.getTime() + 86_400_000), tz)
  const label = day === today ? 'today' : day === tomorrow ? 'tomorrow' : weekday
  return `${label} ${time}`
}
