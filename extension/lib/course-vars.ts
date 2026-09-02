/**
 * course-vars — items.sales_facts turned into merge tokens.
 *
 * Missing facts are OMITTED, never emitted as ''. renderSnippet leaves a token
 * it has no value for visible, so a course with no EMI shows `{{course.emi}}`
 * in the composer — a rep sees that and fixes it. An empty string would send
 * "starting at  a month" and nobody would notice until the customer did.
 */
import type { CourseFacts, CourseItem } from './contracts'

const INR = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })

/** A fee typed as "₹85,000" is still a number; "call us" is not. Stripping the
 *  punctuation off a word leaves '', and Number('') is 0 — hence the length
 *  guard, or every unpriced course would quote itself at ₹0. */
export function amountOf(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string') return null
  const digits = value.replace(/[^\d.-]/g, '')
  if (!digits) return null
  const n = Number(digits)
  return Number.isFinite(n) ? n : null
}

/** "₹85,000" from 85000 or "85000". Null when it is not a number at all. */
export function rupees(value: unknown): string | null {
  const n = amountOf(value)
  return n === null ? null : INR.format(n)
}

/** "15 Oct 2026" in the reader's own locale — a batch date printed in UTC is a
 *  batch date that reads a day early for half of them. */
function localDate(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null
  const at = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value)
  if (Number.isNaN(at.getTime())) return null
  return at.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

function put(out: Record<string, string>, key: string, value: string | null | undefined): void {
  if (value !== null && value !== undefined && value !== '') out[key] = value
}

function textOf(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null
  if (typeof value === 'number') return String(value)
  return null
}

export function courseVars(item: CourseItem | null | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  if (!item) return out
  const facts: CourseFacts = item.sales_facts ?? {}
  put(out, 'course.name', item.name)
  put(out, 'course.fee', rupees(facts.fee))
  put(out, 'course.emi', rupees(facts.emi_monthly))
  put(out, 'course.emi_months', textOf(facts.emi_months))
  put(out, 'course.duration', textOf(facts.duration))
  put(out, 'course.batch_start', localDate(facts.batch_start))
  put(out, 'course.usp', textOf(facts.usp))
  put(out, 'course.proof', textOf(facts.proof))
  return out
}

/** Does this text need a course picked before it is safe to send? */
export function needsCourse(text: string): boolean {
  return /\{\{\s*course\./.test(text)
}
