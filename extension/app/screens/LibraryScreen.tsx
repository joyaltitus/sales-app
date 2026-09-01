import { useCachedScriptLibrary } from '../../lib/panel-data'
import { LibrarySkeleton } from '../../ui/Skeletons'
import { ScriptCard } from '../../ui/ScriptCard'
import { StaleChip } from '../../ui/StaleChip'
import { EmptyState } from '../../../src/ui/EmptyState'
import { ErrorState } from '../../../src/ui/ErrorState'

export default function LibraryScreen({ clientId }: { clientId: string }) {
  const { scripts, loading, error, reload, staleAt } = useCachedScriptLibrary(clientId)
  if (loading) return <main><LibrarySkeleton /></main>
  if (error) {
    return (
      <main>
        <ErrorState title="Couldn’t load the library" body="Check your connection, then retry." onRetry={() => void reload()} />
      </main>
    )
  }
  if (scripts.length === 0) return <EmptyState title="No scripts yet" body="Your manager’s approved scripts will appear here." />
  return (
    <main className="space-y-3 p-3">
      {staleAt && <StaleChip fetched_at={staleAt} />}
      {scripts.map((script) => {
        const current = script.current
        const body = current?.body?.paragraphs.map((p) => `${p.before}${p.highlight ?? ''}${p.after ?? ''}`).join('\n\n') ?? 'No approved copy yet.'
        return <ScriptCard key={script.taxonomyId} title={script.taxonomyLabel} body={body} versionLabel={current ? `v${current.version} · ${current.status}` : undefined} />
      })}
    </main>
  )
}
