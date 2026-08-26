import { Chip } from '../../src/ui/Chip'
import { Button } from '../../src/ui/Button'

type Props = {
  title: string
  body: string
  versionLabel?: string
  onUse?: () => void
}

export function ScriptCard({ title, body, versionLabel, onUse }: Props) {
  return (
    <section aria-label={`Script: ${title}`} className="rounded-lg border border-border bg-surface-raised p-3 shadow-elev-1">
      <div className="mb-1.5 flex items-center gap-2">
        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold tracking-[-0.01em] text-fg">{title}</h3>
        {versionLabel && <Chip tone="accent">{versionLabel}</Chip>}
      </div>
      <p className="whitespace-pre-line text-xs leading-relaxed text-fg-muted">{body}</p>
      {onUse && (
        <Button variant="secondary" size="sm" className="mt-2.5" onClick={onUse}>
          Use this script
        </Button>
      )}
    </section>
  )
}
