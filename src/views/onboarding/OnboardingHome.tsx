import { useEffect, useState } from 'react'
import { useClient } from '../../shell/ClientProvider'
import { Chip } from '../../ui/Chip'
import { EmptyState } from '../../ui/EmptyState'
import { Skeleton } from '../../ui/Skeleton'
import {
  BLOCKS,
  fetchOnboardingProgress,
  relTime,
  type OnboardingProgress,
} from './data'

// ONB §D screen 1 — OnboardingHome, v1 slice: block-status board + scorecard
// tile, all DB-derived. Deferred to CON-01b: BlockDetail, go-live checklist,
// export-all / instantiate actions, lifecycle writes, revisions history.

function BlockCard({
  block,
}: {
  block: OnboardingProgress['blocks'][number]
}) {
  const { def, live, staged, lastChange } = block
  return (
    <div className="rounded-md border border-border bg-surface p-4">
      <div className="mb-2 flex items-start justify-between gap-2">
        <h2 className="text-sm font-semibold text-fg">{def.label}</h2>
        <Chip tone={live > 0 ? 'success' : 'neutral'}>
          {live > 0 ? `${live} live` : 'empty'}
        </Chip>
      </div>
      <div className="flex items-center gap-2 text-xs text-fg-subtle">
        {staged > 0 && <Chip tone="warn">{staged} staged</Chip>}
        <span>changed {relTime(lastChange)}</span>
      </div>
    </div>
  )
}

function ScorecardTile({
  scorecard,
}: {
  scorecard: OnboardingProgress['scorecard']
}) {
  if (!scorecard) {
    return (
      <div className="rounded-md border border-border bg-surface p-4">
        <div className="label-caps mb-2">Last test run</div>
        <p className="text-sm text-fg-muted">
          No test runs yet. Runs land here once Test-2 fires.
        </p>
      </div>
    )
  }
  const pass = scorecard.verdict?.toLowerCase() === 'pass'
  return (
    <div className="rounded-md border border-border bg-surface p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="label-caps">Last test run</div>
        <Chip tone={pass ? 'success' : 'warn'}>
          {scorecard.verdict ?? 'no verdict'}
        </Chip>
      </div>
      <p className="text-sm text-fg">{scorecard.packageKey}</p>
      <p className="mt-1 text-xs text-fg-subtle">
        {relTime(scorecard.finishedAt ?? scorecard.createdAt)} · config{' '}
        {scorecard.configHash.slice(0, 8)}
      </p>
    </div>
  )
}

export function OnboardingHome() {
  const { activeClient } = useClient()
  const [progress, setProgress] = useState<OnboardingProgress | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!activeClient) return
    setProgress(null)
    setError(null)
    fetchOnboardingProgress(activeClient.id)
      .then(setProgress)
      .catch((e: Error) => setError(e.message))
  }, [activeClient])

  if (!activeClient) return null

  if (error) {
    return (
      <section className="p-6">
        <EmptyState title="Couldn't load onboarding state" body={error} />
      </section>
    )
  }

  if (!progress) {
    return (
      <section className="grid gap-3 p-6 sm:grid-cols-2 lg:grid-cols-3">
        {BLOCKS.map((b) => (
          <Skeleton key={b.key} className="h-24 w-full" />
        ))}
      </section>
    )
  }

  return (
    <section className="p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-fg">Onboarding</h1>
        <Chip tone={progress.liveBlocks === BLOCKS.length ? 'success' : 'accent'}>
          {progress.liveBlocks}/{BLOCKS.length} blocks live
        </Chip>
      </div>
      <div className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {progress.blocks.map((b) => (
          <BlockCard key={b.def.key} block={b} />
        ))}
      </div>
      <div className="max-w-md">
        <ScorecardTile scorecard={progress.scorecard} />
      </div>
    </section>
  )
}
