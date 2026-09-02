import type { Rebuttal } from '../lib/contracts'
import { DEFAULT_LANG, resolveParagraphs, toText, winRateLabel } from '../lib/script-text'
import { EmptyState } from '../../src/ui/EmptyState'
import { Chip } from '../../src/ui/Chip'
import { PlaybookIcon } from './ObjectionChips'

type Props = {
  rebuttals: Rebuttal[]
  lang?: string
  onUse?: (rebuttal: Rebuttal) => void
}

function WinRate({ rated, won, uses }: Pick<Rebuttal, 'rated' | 'won' | 'uses'>) {
  const label = winRateLabel(rated, won)
  if (!label.endsWith('%')) return <Chip tone="neutral">{label}</Chip>
  return (
    <span className="shrink-0 text-right">
      <span className="block text-2xs font-semibold text-success tnum">{label} won</span>
      <span className="block text-2xs text-fg-subtle tnum">{uses} uses</span>
    </span>
  )
}

/** Ranked list — the objection-history view. The in-call surface is CallHud;
 *  this is for reading back what worked, not for picking mid-sentence. */
export function RebuttalList({ rebuttals, lang = DEFAULT_LANG, onUse }: Props) {
  if (rebuttals.length === 0) {
    return <EmptyState title="No rebuttals for this objection yet" />
  }

  return (
    <ul className="space-y-2" aria-label="Rebuttals ranked">
      {rebuttals.map((rebuttal, index) => {
        const body = toText(resolveParagraphs(rebuttal.body, lang).paragraphs)
        return (
          <li key={`${rebuttal.script_version_id}-${rebuttal.taxonomy_key}-${index}`}>
            <button
              type="button"
              onClick={() => onUse?.(rebuttal)}
              className="flex min-h-11 w-full items-start gap-2.5 rounded-lg border border-border bg-surface-raised px-3 py-2.5 text-left shadow-elev-1 transition-colors hover:border-border-strong hover:bg-surface"
            >
              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-center gap-1.5">
                  <PlaybookIcon name={rebuttal.icon} size={13} />
                  <span className="min-w-0 truncate text-sm font-medium text-fg">
                    {rebuttal.headline ?? rebuttal.label}
                  </span>
                </span>
                {body && <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-fg-muted">{body}</span>}
              </span>
              <WinRate rated={rebuttal.rated} won={rebuttal.won} uses={rebuttal.uses} />
            </button>
          </li>
        )
      })}
    </ul>
  )
}
