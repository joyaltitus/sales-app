import { ChevronRight, Maximize2 } from 'lucide-react'
import type { PersonalSpin } from '../lib/contracts'
import { HOOK_LABELS, highlighted, pickScript, type HookKey, type RoadmapStep } from '../lib/script-text'
import { PlaybookIcon } from './ObjectionChips'
import { Button } from '../../src/ui/Button'

type Props = {
  steps: RoadmapStep[]
  active: number
  lang: string
  useMine: boolean
  hook: HookKey
  /** Merge values, so the preview reads exactly like the composer will. */
  vars: Record<string, string>
  spinsByScript: (scriptId: string | null) => ReadonlyMap<string, PersonalSpin>
  onSelect: (index: number) => void
  onHook: (key: HookKey) => void
  onInsert: (step: RoadmapStep) => void
  onExpand: (step: RoadmapStep) => void
  /** A call session is open: the rep SAYS the cue, so the verb is not "Insert". */
  inCall?: boolean
  busy?: boolean
}

/**
 * The call roadmap.
 *
 * One step open, the rest one line each. A rep glancing down mid-sentence has
 * to land on the thing they are saying NOW — an accordion where everything is
 * open is a wall of text, and a list where nothing is open is a table of
 * contents.
 */
export function RoadmapStage({
  steps, active, lang, useMine, hook, vars, spinsByScript, onSelect, onHook, onInsert, onExpand, inCall = false, busy = false,
}: Props) {
  if (steps.length === 0) return null
  const current = Math.min(Math.max(active, 0), steps.length - 1)

  return (
    <section aria-label="Call roadmap" className="min-w-0 space-y-1.5">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 items-center gap-1" aria-hidden>
          {steps.map((step, index) => (
            <span
              key={step.key}
              className={[
                'h-1 flex-1 rounded-pill transition-colors',
                index < current ? 'bg-accent' : index === current ? 'bg-accent' : 'bg-border',
                index === current ? '' : 'opacity-60',
              ].join(' ')}
            />
          ))}
        </div>
        <span className="shrink-0 text-2xs font-semibold text-fg-subtle tnum">{current + 1}/{steps.length}</span>
      </div>

      <ol className="min-w-0 space-y-1">
        {steps.map((step, index) => {
          const expanded = index === current
          const picked = pickScript(step.script, lang, useMine, spinsByScript(step.script.script_id))
          return (
            <li key={step.key} className="min-w-0">
              {!expanded ? (
                <div className="flex min-w-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onSelect(index)}
                    className="flex min-h-9 min-w-0 flex-1 items-center gap-1.5 rounded-md px-1.5 text-left text-xs text-fg-subtle transition-colors hover:bg-surface-sunk hover:text-fg"
                  >
                    <span className="w-4 shrink-0 text-2xs font-semibold tnum">{index + 1}</span>
                    <PlaybookIcon name={step.script.icon} size={13} />
                    <span className="min-w-0 flex-1 truncate">{step.script.label}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onExpand(step)}
                    aria-label={`Open ${step.script.label} in full`}
                    className="shrink-0 rounded-md p-1.5 text-fg-subtle hover:bg-surface-sunk hover:text-fg"
                  >
                    <Maximize2 aria-hidden size={13} strokeWidth={1.9} />
                  </button>
                </div>
              ) : (
                <div className="min-w-0 rounded-lg border border-border bg-surface-raised p-2.5 shadow-elev-1">
                  <div className="mb-1 flex min-w-0 items-center gap-1.5">
                    <span className="shrink-0 text-2xs font-semibold text-accent tnum">{index + 1}</span>
                    <PlaybookIcon name={step.script.icon} size={13} />
                    <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">{step.script.label}</h3>
                    {picked.personal && (
                      <span className="shrink-0 rounded-pill border border-border bg-surface-sunk px-1.5 text-2xs font-semibold text-fg-muted">
                        My words
                      </span>
                    )}
                    {picked.fallback && (
                      <span
                          data-testid="lang-fallback"
                          title={`No ${lang} version yet — showing ${picked.lang}`}
                          className="shrink-0 rounded border border-border px-1 text-2xs font-semibold text-fg-subtle"
                        >
                          {picked.lang.toUpperCase()}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => onExpand(step)}
                      aria-label={`Open ${step.script.label} in full`}
                      className="shrink-0 rounded-md p-1.5 text-fg-subtle hover:bg-surface-sunk hover:text-fg"
                    >
                      <Maximize2 aria-hidden size={14} strokeWidth={1.9} />
                    </button>
                  </div>

                  {/* The opener is three scripts wearing one step. Which one is a
                      guess from the lead's history, so it stays changeable. */}
                  {step.variants.length > 1 && (
                    <div className="mb-1.5 flex gap-1" role="group" aria-label="Opener">
                      {step.variants.map((variant) => {
                        const key = variant.taxonomy_key as HookKey
                        const on = key === hook
                        return (
                          <button
                            key={variant.taxonomy_id}
                            type="button"
                            aria-pressed={on}
                            onClick={() => onHook(key)}
                            className={[
                              'min-h-9 flex-1 rounded-md border px-1 text-2xs font-semibold transition-colors',
                              on ? 'border-accent bg-accent-subtle text-accent' : 'border-border bg-surface-sunk text-fg-muted hover:text-fg',
                            ].join(' ')}
                          >
                            {HOOK_LABELS[key] ?? variant.label}
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {picked.paragraphs.length === 0 ? (
                    <p className="text-xs text-fg-subtle">No script written for this step yet.</p>
                  ) : (
                    /* Sayable, not readable. ~20px in a ~45ch column is
                       teleprompter practice: the eye travels DOWN a narrow
                       measure instead of across a document. Nothing is clamped
                       — half a sentence cannot be said out loud, and break-words
                       plus the HUD's own overflow-hidden already hold the column. */
                    <ul data-testid="cue" className="max-w-[45ch] space-y-2">
                      {picked.paragraphs.slice(0, 3).map((paragraph, i) => (
                        <li key={i} className="flex min-w-0 gap-2 text-lg leading-normal text-fg-muted">
                          <span aria-hidden className="mt-3 h-1 w-1 shrink-0 rounded-pill bg-border-strong" />
                          <span className="min-w-0 break-words">{highlighted(paragraph, vars)}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="mt-2 flex gap-1.5">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="min-h-11 flex-1"
                      disabled={busy || picked.paragraphs.length === 0}
                      onClick={() => onInsert(step)}
                    >
                      {inCall ? 'Said it →' : 'Insert'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="min-h-11 flex-1"
                      disabled={busy || index >= steps.length - 1}
                      onClick={() => onSelect(index + 1)}
                    >
                      Next
                      <ChevronRight aria-hidden size={13} strokeWidth={2} />
                    </Button>
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
