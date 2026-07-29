// The handover seam — the one thing this app is remembered by (direction §1.3).
//
// Every thread has two authors. turn_traces.route is literally the machine's
// reasoning, nine values, code-canonical in hub-service src/engine/trace-route.ts.
// This file maps that enum to plain words a rep can read. The label is DERIVED,
// never authored, and never names the machinery: the rep sees "BOT PAUSED HERE",
// not `route=paused` (§1.9).

export type TraceRoute =
  | 'escalate'
  | 'deflect'
  | 'playbook'
  | 'llm'
  | 'error'
  | 'suppressed'
  | 'paused'
  | 'captured'
  | 'media'

type SeamKind =
  | { kind: 'seam'; label: string } //   full-bleed hairline across the timeline
  | { kind: 'tag'; label: string } //    inline tag on the bot message, no hairline
  | { kind: 'none' } //                  the normal case — draw nothing

// §1.3's table, verbatim. Nine routes, all accounted for.
const ROUTES: Record<TraceRoute, SeamKind> = {
  escalate: { kind: 'seam', label: 'Handed to you' },
  paused: { kind: 'seam', label: 'Bot paused here' },
  error: { kind: 'seam', label: 'Bot failed here' },
  suppressed: { kind: 'seam', label: 'Held back' },
  captured: { kind: 'seam', label: 'Logged, no reply' },
  deflect: { kind: 'tag', label: 'Auto-replied' },
  playbook: { kind: 'tag', label: 'Playbook reply' },
  media: { kind: 'tag', label: 'Sent media' },
  llm: { kind: 'none' },
}

/** An unrecognised route degrades to nothing rather than throwing or rendering a
 *  placeholder. The route enum is stable and contract-tested on the hub-service
 *  side, but a UI that hard-fails on a tenth value is a UI that breaks on the day
 *  someone adds one. */
export function classifyRoute(route: string): SeamKind {
  return ROUTES[route as TraceRoute] ?? { kind: 'none' }
}

export type Trace = {
  id: string
  route: string
  matched_rule_key: string | null
  created_at: string
}

export type SeamMark =
  | { kind: 'seam'; id: string; label: string; ruleKey: string | null }
  | { kind: 'tag'; id: string; label: string; ruleKey: string | null }

/**
 * Resolve a chronological trace list into the marks to render.
 *
 * THE RULE (§1.3): a seam is drawn only on a TRANSITION, never per message.
 * "Five seams in a row is noise; one seam that says HANDED TO YOU · PRICING is
 * the whole product in a line of type."
 *
 * So a seam-drawing route that repeats while control has not gone back to the
 * machine draws once. A non-seam route means the bot is handling the thread
 * again, which resets the state — the NEXT escalate is a genuine new transition
 * and does draw.
 */
export function resolveMarks(traces: Trace[]): Map<string, SeamMark> {
  const marks = new Map<string, SeamMark>()
  let lastSeamRoute: string | null = null

  for (const t of traces) {
    const c = classifyRoute(t.route)
    if (c.kind === 'seam') {
      if (lastSeamRoute !== t.route) {
        marks.set(t.id, {
          kind: 'seam',
          id: t.id,
          label: c.label,
          ruleKey: t.matched_rule_key,
        })
        lastSeamRoute = t.route
      }
      continue
    }
    if (c.kind === 'tag') {
      marks.set(t.id, { kind: 'tag', id: t.id, label: c.label, ruleKey: t.matched_rule_key })
    }
    // Any non-seam route (tag or the plain `llm` case) means the machine is back
    // in control, so the next seam-worthy route is a fresh transition.
    lastSeamRoute = null
  }

  return marks
}
