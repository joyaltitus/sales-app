/**
 * script-text — which paragraphs to say, in which dialect, and how to show them.
 *
 * Pure. The one rule that matters: a rep must never be handed a blank card. A
 * missing dialect falls back to the default body and SAYS it fell back, because
 * silently showing English to someone who picked Manglish looks like a bug and
 * reads like one mid-call.
 */
import { Fragment, createElement, type ReactNode } from 'react'
import type { PersonalSpin, QueueItem, Rebuttal, ScriptBody, ScriptParagraph } from './contracts'
import { renderSnippet } from './snippet'

export const DEFAULT_LANG = 'en'

export type ResolvedScript = {
  paragraphs: ScriptParagraph[]
  /** true when the asked-for dialect had no variant and this is the default body. */
  fallback: boolean
  /** The dialect actually returned. */
  lang: string
}

export function resolveParagraphs(body: ScriptBody | null | undefined, lang: string): ResolvedScript {
  const base = body?.lang ?? DEFAULT_LANG
  const paragraphs = body?.paragraphs ?? []
  if (!body || lang === base) return { paragraphs, fallback: false, lang: base }
  const variant = body.variants?.[lang]
  if (variant?.paragraphs?.length) return { paragraphs: variant.paragraphs, fallback: false, lang }
  return { paragraphs, fallback: true, lang: base }
}

/** Dialects this body actually carries, default first. */
export function bodyLangs(body: ScriptBody | null | undefined): string[] {
  if (!body) return []
  const all = [body.lang ?? DEFAULT_LANG, ...Object.keys(body.variants ?? {})]
  return all.filter((lang, index) => all.indexOf(lang) === index)
}

/** Flatten to the plain text that goes into the WhatsApp composer. */
export function toText(paragraphs: readonly ScriptParagraph[]): string {
  return paragraphs
    .map((p) => `${p.before ?? ''}${p.highlight ?? ''}${p.after ?? ''}`.trim())
    .filter(Boolean)
    .join('\n\n')
}

/**
 * The highlight is the line that closes, so it renders heavy and the eye lands
 * on it first. Tokens are merged HERE too, not only on insert: a preview that
 * shows `{{course.fee}}` while the composer would show ₹85,000 teaches the rep
 * to distrust the preview. Unfilled tokens stay visible, which is the signal
 * that something is missing.
 *
 * createElement rather than JSX keeps this file a plain .ts helper.
 */
export function highlighted(paragraph: ScriptParagraph, vars: Record<string, string> = {}): ReactNode {
  const fill = (value: string | null | undefined) => (value ? renderSnippet(value, vars) : '')
  return createElement(
    Fragment,
    null,
    fill(paragraph.before),
    paragraph.highlight
      ? createElement('strong', { className: 'font-semibold text-fg' }, fill(paragraph.highlight))
      : null,
    fill(paragraph.after),
  )
}

export type HookKey = 'stage_hook_cold' | 'stage_hook_inbound' | 'stage_hook_followup'

/**
 * Which opener this call wants. The rep can override in the HUD — this only
 * has to be right often enough that overriding is the exception.
 */
export function hookVariant(
  lead: Pick<QueueItem, 'reason' | 'channel'>,
  calls: readonly unknown[] = [],
): HookKey {
  if (lead.reason === 'new' && lead.channel !== 'phone') return 'stage_hook_inbound'
  if (calls.length > 0 || lead.reason === 'due' || lead.reason === 'overdue' || lead.reason === 'idle') {
    return 'stage_hook_followup'
  }
  return 'stage_hook_cold'
}

export const HOOK_LABELS: Record<HookKey, string> = {
  stage_hook_cold: 'Cold',
  stage_hook_inbound: 'Inbound',
  stage_hook_followup: 'Follow-up',
}

/** Composed texts and hook variants are looked up BY KEY, never by position. */
export const COMPOSED_KEYS = { callbackConfirm: 'callback_confirm', tokenRequest: 'token_request' } as const
export const HOOK_KEYS: HookKey[] = ['stage_hook_cold', 'stage_hook_inbound', 'stage_hook_followup']

/** Stage rows at or above this position are composed texts looked up by key,
 *  not steps of the call. */
export const COMPOSED_FROM = 90

export type RoadmapStep = {
  /** 'hook' for the collapsed opener, else the taxonomy key. */
  key: string
  script: Rebuttal
  /** The cold/inbound/follow-up siblings, when this is the opener. */
  variants: Rebuttal[]
}

/**
 * The call roadmap: stage rows below the composed-text band, in author order,
 * with the three hook variants collapsed into ONE step. Three openers as three
 * steps would read as "say all three", which is the opposite of the point.
 */
export function buildRoadmap(scripts: readonly Rebuttal[], hook: HookKey): RoadmapStep[] {
  const stages = scripts
    .filter((s) => s.kind === 'stage' && s.position < COMPOSED_FROM && s.status === 'active')
    .sort((a, b) => a.position - b.position)
  const hooks = stages.filter((s) => (HOOK_KEYS as string[]).includes(s.taxonomy_key))
  const steps: RoadmapStep[] = []
  let hookPlaced = false
  for (const stage of stages) {
    if ((HOOK_KEYS as string[]).includes(stage.taxonomy_key)) {
      if (hookPlaced) continue
      hookPlaced = true
      steps.push({ key: 'hook', script: hooks.find((s) => s.taxonomy_key === hook) ?? stage, variants: hooks })
      continue
    }
    steps.push({ key: stage.taxonomy_key, script: stage, variants: [] })
  }
  return steps
}

/** Objection chips: active objection rows, in the order the manager set. */
export function objectionScripts(scripts: readonly Rebuttal[]): Rebuttal[] {
  return scripts.filter((s) => s.kind === 'objection' && s.status === 'active')
    .sort((a, b) => a.position - b.position || a.label.localeCompare(b.label))
}

/** A composed text (token_request, callback_confirm) by key. */
export function composedScript(scripts: readonly Rebuttal[], key: string): Rebuttal | null {
  return scripts.find((s) => s.kind === 'stage' && s.taxonomy_key === key) ?? null
}

export type PickedScript = ResolvedScript & {
  /** true when this is the rep's own wording rather than the company standard. */
  personal: boolean
}

/**
 * What to actually show: the rep's spin for this dialect when they are on
 * "Mine" and have one, else the standard. A missing spin silently falls back —
 * "Mine" is a preference, not a promise that one exists for every script.
 */
export function pickScript(
  script: Pick<Rebuttal, 'body' | 'script_id'> | null,
  lang: string,
  useMine: boolean,
  spins: ReadonlyMap<string, PersonalSpin>,
): PickedScript {
  const spin = useMine ? spins.get(lang) : undefined
  if (spin && spin.body.trim()) {
    return { paragraphs: [{ before: spin.body }], fallback: false, lang, personal: true }
  }
  return { ...resolveParagraphs(script?.body, lang), personal: false }
}

/** Win rate as the chip says it: a number only once it means something. */
export function winRateLabel(rated: number, won: number): string {
  if (rated >= 10) return `${Math.round((won / rated) * 100)}%`
  return rated > 0 ? 'early' : 'untested'
}
