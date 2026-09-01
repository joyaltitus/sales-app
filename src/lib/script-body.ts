// Script body: authoring text ⇄ stored paragraphs, dialect resolution and
// merge-token rendering. Pure — no supabase, no React — because every one of
// these is called from three places (the manager editor, the rep read view and
// the teardown fix box) and each is a correctness trap worth a test.
//
// The stored shape is migration 068's:
//   body = { paragraphs:[{before, highlight?, after?}], lang:'en',
//            variants:{ mn:{paragraphs:[...]}, hi:{...} } }
// A pre-068 row is just { paragraphs:[...] } with no lang and no variants, and
// every function here has to keep working on one — those rows are live.

export type ScriptParagraph = { before: string; highlight?: string; after?: string }

export type ScriptBody = {
  paragraphs: ScriptParagraph[]
  lang?: string
  variants?: Record<string, { paragraphs: ScriptParagraph[] }>
}

export const DEFAULT_LANG = 'en'

/** Authoring syntax: blank line = new paragraph, `**bold**` = the one
 *  highlight. Deliberately not Markdown — a manager types into a textarea
 *  mid-coaching-session, so the whole syntax has to fit in one hint line. */
const HIGHLIGHT = /\*\*([\s\S]+?)\*\*/

/** Same contract as the extension's renderSnippet (extension/lib/snippet.ts):
 *  an unknown token stays visible verbatim rather than blanking, because a rep
 *  must SEE that a placeholder did not resolve while they are on the call. */
const TOKEN = /\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g

/** Textarea text → stored paragraphs. Never throws: a manager mid-sentence has
 *  unbalanced `**` most of the time, and that must render as literal asterisks
 *  rather than eating the rest of the script. */
export function parseAuthoring(text: string): ScriptParagraph[] {
  if (!text) return []
  return text
    .replace(/\r\n?/g, '\n') // CRLF (Windows paste) and lone CR (old Mac paste)
    .split(/\n[ \t]*\n+/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const match = HIGHLIGHT.exec(chunk)
      // Only the FIRST balanced pair becomes the highlight; any later `**`
      // stays literal in `after`, which is what "one per paragraph" means.
      if (!match) return { before: chunk }
      return {
        before: chunk.slice(0, match.index),
        highlight: match[1],
        after: chunk.slice(match.index + match[0].length),
      }
    })
}

/** Stored paragraphs → textarea text. Inverse of parseAuthoring: for anything
 *  parseAuthoring produced, parseAuthoring(toAuthoring(p)) deep-equals p. */
export function toAuthoring(paragraphs: ScriptParagraph[] | null | undefined): string {
  return (paragraphs ?? [])
    .map((p) => `${p.before}${p.highlight ? `**${p.highlight}**` : ''}${p.after ?? ''}`)
    .join('\n\n')
}

/** The paragraphs to show for `lang`, and whether the reader is looking at a
 *  fallback rather than the dialect they asked for. `fallback` is what drives
 *  the "EN" badge — a pre-068 row has no variants at all, and showing its
 *  English silently would tell a Manglish-speaking rep nothing. */
export function resolveParagraphs(
  body: ScriptBody | null | undefined,
  lang: string,
): { paragraphs: ScriptParagraph[]; fallback: boolean } {
  const variant = body?.variants?.[lang]
  if (variant?.paragraphs?.length) return { paragraphs: variant.paragraphs, fallback: false }
  return { paragraphs: body?.paragraphs ?? [], fallback: (body?.lang ?? DEFAULT_LANG) !== lang }
}

/** Every dialect this version actually carries — its base lang first, then the
 *  variant keys. Union this with sales_config.languages for the editor's tabs:
 *  a version can carry a dialect the tenant has since stopped offering. */
export function variantLangs(body: ScriptBody | null | undefined): string[] {
  const base = body?.lang ?? DEFAULT_LANG
  const keys = Object.keys(body?.variants ?? {}).filter((k) => k !== base)
  return body ? [base, ...keys.sort()] : []
}

function stringify(value: unknown): string {
  return value === null || value === undefined ? '' : String(value)
}

function mergeText(text: string, vars: Record<string, unknown>): string {
  return text.replace(TOKEN, (token, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? stringify(vars[key]) : token,
  )
}

/** Substitute {{tokens}} while KEEPING the paragraph structure, so a preview
 *  can still bold the highlight. Unknown tokens stay visible (see TOKEN). */
export function renderMerged(
  paragraphs: ScriptParagraph[] | null | undefined,
  vars: Record<string, unknown>,
): ScriptParagraph[] {
  return (paragraphs ?? []).map((p) => ({
    before: mergeText(p.before, vars),
    ...(p.highlight === undefined ? {} : { highlight: mergeText(p.highlight, vars) }),
    ...(p.after === undefined ? {} : { after: mergeText(p.after, vars) }),
  }))
}

/** Every token named anywhere in the body (base + all variants), in first-seen
 *  order. The Courses tab uses this to list facts a script asks for but the
 *  course does not define yet. */
export function findTokens(body: ScriptBody | null | undefined): string[] {
  const seen = new Set<string>()
  const scan = (paragraphs: ScriptParagraph[] | null | undefined) => {
    for (const p of paragraphs ?? []) {
      for (const text of [p.before, p.highlight ?? '', p.after ?? '']) {
        for (const m of text.matchAll(TOKEN)) seen.add(m[1])
      }
    }
  }
  scan(body?.paragraphs)
  for (const variant of Object.values(body?.variants ?? {})) scan(variant.paragraphs)
  return [...seen]
}

/** The merge map the previews and the extension both need. Kept here so the
 *  token NAMES live next to the parser that finds them — a token added to a
 *  script body and not to this map is exactly the "underlined, unresolved"
 *  case the preview is built to show. */
export function buildMergeVars({
  contactName,
  repName,
  clientName,
  course,
  salesConfig,
  callbackWhen,
}: {
  contactName?: string | null
  repName?: string | null
  clientName?: string | null
  course?: { name?: string | null; facts?: Record<string, unknown> | null } | null
  salesConfig?: { tokenAmount?: number | null; payUrl?: string | null; upiVpa?: string | null } | null
  callbackWhen?: string | null
} = {}): Record<string, unknown> {
  const facts = course?.facts ?? {}
  const vars: Record<string, unknown> = {}
  // Only defined keys are set: an absent key is what keeps the token visible.
  const put = (key: string, value: unknown) => {
    if (value !== undefined && value !== null && value !== '') vars[key] = value
  }
  put('name', contactName)
  put('rep', repName)
  put('client.name', clientName)
  put('course.name', course?.name)
  put('course.fee', facts.fee)
  put('course.emi', facts.emi_monthly)
  put('course.emi_months', facts.emi_months)
  put('course.usp', facts.usp)
  put('course.proof', facts.proof)
  put('pay.amount', salesConfig?.tokenAmount ?? facts.token_amount)
  put('pay.url', salesConfig?.payUrl)
  put('pay.upi', salesConfig?.upiVpa)
  put('callback.when', callbackWhen)
  return vars
}
