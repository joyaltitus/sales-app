import { useState } from 'react'
import { ArrowLeft, Maximize2, ThumbsDown, ThumbsUp } from 'lucide-react'
import type { Rebuttal } from '../lib/contracts'
import { highlighted, type PickedScript } from '../lib/script-text'
import { PlaybookIcon, WinRateChip } from './ObjectionChips'
import { Button } from '../../src/ui/Button'

type Props = {
  script: Rebuttal
  picked: PickedScript
  /** Merge values, so the preview reads exactly like the composer will. */
  vars: Record<string, string>
  /** The roadmap step the rep will come back to. */
  backLabel: string
  onBack: () => void
  onInsert: () => void
  onExpand: () => void
  /** 👎 carries the customer's own words when the rep typed them. */
  onFeedback: (feedback: 'worked' | 'didnt_work', words?: string) => void
  /** null until this rebuttal has been inserted — nothing to rate before that. */
  rated: 'worked' | 'didnt_work' | null
  canRate: boolean
  busy?: boolean
}

/**
 * One objection, answered.
 *
 * Replaces the roadmap body rather than opening beside it: at 380px two panes
 * is one pane and a sliver. The "back to <step>" link is the whole navigation
 * model — the roadmap remembers where it was.
 */
export function RebuttalCard({
  script, picked, vars, backLabel, onBack, onInsert, onExpand, onFeedback, rated, canRate, busy = false,
}: Props) {
  const [asking, setAsking] = useState(false)
  const [words, setWords] = useState('')

  return (
    <section aria-label={`Rebuttal: ${script.label}`} className="min-w-0 space-y-2">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="flex min-h-9 min-w-0 items-center gap-1 rounded-md px-1.5 text-xs font-medium text-fg-muted hover:bg-surface-sunk hover:text-fg"
        >
          <ArrowLeft aria-hidden size={13} strokeWidth={2} className="shrink-0" />
          <span className="truncate">back to {backLabel}</span>
        </button>
        <WinRateChip script={script} />
        <span className="ml-auto shrink-0 text-2xs text-fg-subtle tnum">
          {script.rated} rated · {script.uses} uses
        </span>
      </div>

      <div className="min-w-0 rounded-lg border border-border bg-surface-raised p-2.5 shadow-elev-1">
        <div className="mb-1 flex min-w-0 items-start gap-1.5">
          <span className="mt-0.5"><PlaybookIcon name={script.icon} /></span>
          <h3 className="line-clamp-2 min-w-0 flex-1 text-sm leading-snug font-semibold break-words text-fg">
            {script.headline ?? script.label}
          </h3>
          {picked.fallback && (
            <span
                data-testid="lang-fallback"
                title={`Showing ${picked.lang.toUpperCase()} — no version in the dialect you picked`}
                className="shrink-0 rounded border border-border px-1 text-2xs font-semibold text-fg-subtle"
              >
                {picked.lang.toUpperCase()}
            </span>
          )}
          <button
            type="button"
            onClick={onExpand}
            aria-label={`Open ${script.label} in full`}
            className="shrink-0 rounded-md p-1.5 text-fg-subtle hover:bg-surface-sunk hover:text-fg"
          >
            <Maximize2 aria-hidden size={14} strokeWidth={1.9} />
          </button>
        </div>
        {picked.paragraphs.length === 0 ? (
          <p className="text-xs text-fg-subtle">No script written for this objection yet.</p>
        ) : (
          <ul className="space-y-1">
            {picked.paragraphs.slice(0, 3).map((paragraph, index) => (
              <li key={index} className="line-clamp-2 text-xs leading-relaxed break-words text-fg-muted">
                {highlighted(paragraph, vars)}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-2 flex items-center gap-1.5">
          <Button variant="secondary" size="sm" className="min-h-11 flex-1" disabled={busy || picked.paragraphs.length === 0} onClick={onInsert}>
            Insert to WA
          </Button>
          <button
            type="button"
            aria-label="Worked"
            aria-pressed={rated === 'worked'}
            disabled={busy || !canRate}
            onClick={() => onFeedback('worked')}
            className={[
              'flex min-h-11 w-11 items-center justify-center rounded-md border transition-colors disabled:opacity-40',
              rated === 'worked' ? 'border-success bg-success-subtle text-success' : 'border-border bg-surface-sunk text-fg-muted hover:text-fg',
            ].join(' ')}
          >
            <ThumbsUp aria-hidden size={15} strokeWidth={1.9} />
          </button>
          <button
            type="button"
            aria-label="Missed"
            aria-pressed={rated === 'didnt_work'}
            disabled={busy || !canRate}
            onClick={() => { onFeedback('didnt_work'); setAsking(true) }}
            className={[
              'flex min-h-11 w-11 items-center justify-center rounded-md border transition-colors disabled:opacity-40',
              rated === 'didnt_work' ? 'border-danger bg-danger-subtle text-danger' : 'border-border bg-surface-sunk text-fg-muted hover:text-fg',
            ].join(' ')}
          >
            <ThumbsDown aria-hidden size={15} strokeWidth={1.9} />
          </button>
        </div>
        {/* The gap is only worth writing while the words are still in the rep's
            ear — an hour later it is a paraphrase, and a paraphrase teaches the
            playbook nothing. */}
        {asking && (
          <form
            className="mt-2 flex items-center gap-1.5"
            onSubmit={(event) => {
              event.preventDefault()
              const said = words.trim()
              if (said) onFeedback('didnt_work', said)
              setWords('')
              setAsking(false)
            }}
          >
            <input
              value={words}
              autoFocus
              onChange={(event) => setWords(event.target.value)}
              placeholder="What did they say?"
              aria-label="What did they say?"
              className="min-h-11 w-full min-w-0 flex-1 rounded-md border border-border bg-surface px-2.5 text-xs text-fg placeholder:text-fg-subtle"
            />
            <Button type="submit" variant="ghost" size="sm" className="min-h-11 shrink-0" disabled={words.trim() === ''}>
              Send
            </Button>
          </form>
        )}
      </div>
    </section>
  )
}
