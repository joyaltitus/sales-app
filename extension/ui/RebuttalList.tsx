import type { Rebuttal } from '../lib/contracts'
import { Chip } from '../../src/ui/Chip'
import { EmptyState } from '../../src/ui/EmptyState'

type Props = {
  rebuttals: Rebuttal[]
  onUse?: (rebuttal: Rebuttal) => void
}

function WinRate({ uses, won }: { uses: number; won: number }) {
  if (uses === 0) return <Chip tone="neutral">untested</Chip>
  const pct = Math.round((won / uses) * 100)
  return (
    <span className="shrink-0 text-right">
      <span className="block text-2xs font-semibold text-success tnum">{pct}% won</span>
      <span className="block text-2xs text-fg-subtle tnum">{uses} uses</span>
    </span>
  )
}

export function RebuttalList({ rebuttals, onUse }: Props) {
  if (rebuttals.length === 0) {
    return <EmptyState title="No rebuttals for this objection yet" />
  }

  return (
    <ul className="space-y-2" aria-label="Rebuttals ranked">
      {rebuttals.map((rebuttal, index) => (
        <li key={`${rebuttal.script_version_id}-${rebuttal.taxonomy_key}-${index}`}>
          <button
            type="button"
            onClick={() => onUse?.(rebuttal)}
            className="flex min-h-11 w-full items-start gap-2.5 rounded-lg border border-border bg-surface-raised px-3 py-2.5 text-left shadow-elev-1 transition-colors hover:border-border-strong hover:bg-surface"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-fg">{rebuttal.headline ?? rebuttal.taxonomy_key}</span>
              {typeof rebuttal.body === 'string' && rebuttal.body !== '' && (
                <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-fg-muted">{rebuttal.body}</span>
              )}
            </span>
            <WinRate uses={rebuttal.uses} won={rebuttal.won} />
          </button>
        </li>
      ))}
    </ul>
  )
}
