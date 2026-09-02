import { Info, ShieldAlert, TriangleAlert } from 'lucide-react'
import type { Collision, HonestyWarning } from '../../lib/manage-data'

// Small pieces every manage tab shares. They exist so five tabs cannot drift on
// how a refusal, a collision or a blast radius is worded — the wording IS the
// product here: a silent re-route is the failure mode this whole surface is
// designed around, so the sentence that prevents it has to be the same sentence
// everywhere.

/** The props each tab takes. `preview` feeds the /preview gallery fixed rows
 *  with no session and no network — the hook is called with `null` and the
 *  passed rows render instead. Same shape as TeamPage's. */
export type TabProps<T> = {
  clientId: string
  userId: string | null
  names: Map<string, string>
  preview?: T[]
}

/** Refusal codes this surface can actually provoke. The raw code is ALWAYS
 *  shown; the gloss is a courtesy, never a replacement, so an unrecognised code
 *  still reaches the operator intact. */
const CODE_HELP: Record<string, string> = {
  denied: 'The database refused the write for your role. Nothing changed.',
  forbidden: 'Your role may not do this.',
  refused: 'The server declined this change. Nothing changed.',
  write_failed: 'The write did not complete. Nothing changed.',
  no_campaign: 'That campaign no longer exists.',
  no_rule: 'That reply no longer exists.',
  unknown_bundle: 'That media bundle is not one of yours.',
  empty_response: 'The reply text cannot be empty.',
  invalid_spend: 'Spend must be zero or more.',
  collision: 'A word here already means something else. See the list above.',
  not_revertable: 'This kind of row has no restore path yet.',
  nothing_to_restore: 'This entry created the row — there is no earlier version.',
  invalid_kind: 'This row cannot be deactivated from here.',
  self_approval: 'You proposed this. Someone else has to approve it.',
  not_escalated: 'This step never needed a manager, so there is nothing to approve.',
  no_pending_plan: 'That request has already been answered.',
  tier_mismatch: 'The request changed since this screen loaded. Reload and try again.',
  no_key: 'This browser has no gateway key saved yet.',
  unavailable: 'hub-service could not reach its database. Nothing changed.',
}

export function WriteFailure({ code }: { code: string }) {
  return (
    <p className="mt-2 text-xs text-danger" role="alert">
      <span className="font-mono font-semibold">{code}</span>
      {CODE_HELP[code] ? <span className="text-fg-muted"> — {CODE_HELP[code]}</span> : null}
    </p>
  )
}

/** Authoring lint. Explicitly advisory: the guardrail on the send path still
 *  holds, so blocking a save on a regex would only cost the operator a true
 *  sentence it happened to match. */
export function HonestyNotes({ warnings }: { warnings: HonestyWarning[] }) {
  if (warnings.length === 0) return null
  return (
    <ul className="mt-2 space-y-1">
      {warnings.map((w) => (
        <li key={w.key} className="flex items-start gap-1.5 text-xs text-warn">
          <TriangleAlert aria-hidden size={13} className="mt-0.5 shrink-0" />
          <span>
            <span className="font-semibold capitalize">{w.key}</span>
            <span className="text-fg-muted"> — {w.why}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

const COLLISION_WORDS: Record<Collision['kind'], (ref: string | null) => string> = {
  escalation: () => 'is how customers ask for a human. Using it here would break that routing.',
  optout: () => 'is how customers opt out. Using it here would swallow their “STOP”.',
  rule: (ref) => `already triggers the automatic reply “${ref}”, which would stop firing.`,
  campaign: (ref) => `is already a code word for the campaign “${ref}”.`,
  knowledge: (ref) => `is also a keyword on the FAQ “${ref}”. Whichever matches first wins.`,
}

/** Collisions in plain language. `block` is not overridable — the escalation and
 *  opt-out lexicons decide whether a customer can reach a human or stop hearing
 *  from us, and no tenant setting outranks that. */
export function Collisions({ collisions }: { collisions: Collision[] }) {
  if (collisions.length === 0) return null
  return (
    <ul className="mt-2 space-y-1">
      {collisions.map((c, i) => {
        const blocking = c.severity === 'block'
        return (
          <li
            key={`${c.keyword}-${c.kind}-${i}`}
            className={['flex items-start gap-1.5 text-xs', blocking ? 'text-danger' : 'text-warn'].join(' ')}
            role={blocking ? 'alert' : undefined}
          >
            {blocking ? (
              <ShieldAlert aria-hidden size={13} className="mt-0.5 shrink-0" />
            ) : (
              <TriangleAlert aria-hidden size={13} className="mt-0.5 shrink-0" />
            )}
            <span>
              <span className="font-semibold">“{c.keyword}”</span>{' '}
              <span className="text-fg-muted">{COLLISION_WORDS[c.kind]?.(c.ref) ?? 'is already in use.'}</span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}

/** Blast radius after a deactivate. NOT an error — the row IS deactivated, and
 *  these are the things still pointing at it. §G.2 rail 3: no silent routing
 *  breakage, so an empty list says so out loud too. */
export function RefsNote({ refs, noun }: { refs: { kind: string; ref: string }[] | null; noun: string }) {
  if (!refs) return null
  if (refs.length === 0) {
    return (
      <p className="mt-2 flex items-center gap-1.5 text-xs text-fg-muted">
        <Info aria-hidden size={13} /> Deactivated. Nothing else referred to this {noun}.
      </p>
    )
  }
  return (
    <div className="mt-2 rounded-md border border-[color-mix(in_srgb,var(--warn)_20%,transparent)] bg-warn-subtle p-2.5">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-warn">
        <TriangleAlert aria-hidden size={13} /> Deactivated — {refs.length} thing
        {refs.length === 1 ? '' : 's'} still point at this {noun}:
      </p>
      <ul className="mt-1 space-y-0.5 pl-5 text-xs text-fg-muted">
        {refs.map((r, i) => (
          <li key={`${r.kind}-${r.ref}-${i}`}>
            {r.kind}: <span className="font-mono">{r.ref}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** The expander widget for keyword sets: type, Enter, remove. Kept as one
 *  component because both FAQs and campaign code words feed the same collision
 *  gate, and two spellings of "add a keyword" would be two spellings of the
 *  most dangerous edit on this screen. */
export function KeywordExpander({
  label,
  words,
  onChange,
  hint,
}: {
  label: string
  words: string[]
  onChange: (next: string[]) => void
  hint?: string
}) {
  return (
    <div>
      <span className="label-caps">{label}</span>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {words.map((w) => (
          <button
            key={w}
            type="button"
            onClick={() => onChange(words.filter((x) => x !== w))}
            className="inline-flex items-center gap-1 rounded-pill border border-border bg-surface-sunk px-2.5 py-1 text-xs text-fg hover:border-danger hover:text-danger"
            aria-label={`Remove ${w}`}
          >
            {w} <span aria-hidden>×</span>
          </button>
        ))}
        <input
          className="min-w-32 flex-1 rounded-md border border-border bg-surface-raised px-2.5 py-1 text-xs text-fg"
          placeholder="Add a word, then press Enter"
          aria-label={`Add to ${label}`}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return
            e.preventDefault()
            const value = e.currentTarget.value.trim().toLowerCase()
            if (!value || words.includes(value)) return
            onChange([...words, value])
            e.currentTarget.value = ''
          }}
        />
      </div>
      {hint ? <span className="mt-1 block text-2xs text-fg-subtle">{hint}</span> : null}
    </div>
  )
}
