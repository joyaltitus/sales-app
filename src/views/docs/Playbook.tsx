import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BookOpen, GraduationCap, Library, Merge, PenLine, SlidersHorizontal } from 'lucide-react'
import { EmptyState } from '../../ui/EmptyState'
import { ErrorState } from '../../ui/ErrorState'
import { Skeleton } from '../../ui/Skeleton'
import { useClient } from '../../shell/ClientProvider'
import { useAuth } from '../../auth/AuthProvider'
import { useScriptLibrary, useWinRates } from '../../lib/scripts-data'
import { useCourses, useSalesConfig, useSpins } from '../../lib/sales-settings-data'
import { LibraryView } from './playbook/LibraryView'
import { EditorView } from './playbook/EditorView'
import { TaxonomyView } from './playbook/TaxonomyView'
import { SettingsView } from './playbook/SettingsView'
import { CoursesView } from './playbook/CoursesView'
import { ReadView } from './playbook/ReadView'

// Tab shell only. Each tab is its own file under ./playbook — this one owns the
// reads every tab shares, the tab strip, and the ?taxonomy= deep link the
// extension uses to jump a manager straight into the right script.

type PlaybookView = 'library' | 'editor' | 'taxonomy' | 'settings' | 'courses' | 'read'
type DisplayState = 'ready' | 'loading' | 'error'

function LoadingGrid() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <Skeleton className="h-56" />
      <Skeleton className="h-56" />
      <Skeleton className="h-56" />
    </div>
  )
}

export function Playbook({ canManage, displayState = 'ready' }: { canManage: boolean; displayState?: DisplayState }) {
  const { activeClient } = useClient()
  const { session } = useAuth()
  const clientId = activeClient?.id ?? null
  const actorId = session?.user.id ?? null

  const library = useScriptLibrary(clientId)
  const winRates = useWinRates(clientId)
  const salesConfig = useSalesConfig(clientId)
  const courses = useCourses(clientId)
  const spins = useSpins(clientId, actorId)

  const [searchParams, setSearchParams] = useSearchParams()
  const [view, setView] = useState<PlaybookView>(canManage ? 'library' : 'read')
  const [selectedTaxonomyId, setSelectedTaxonomyId] = useState<string | null>(null)

  const activeScripts = useMemo(
    () => library.scripts.filter((s) => s.taxonomyStatus === 'active'),
    [library.scripts],
  )

  // The extension deep-links /docs?workspace=playbook&taxonomy=<id>. Honour it
  // once, then drop the param so a later tab change is not undone by a reload.
  const deepLinked = searchParams.get('taxonomy')
  useEffect(() => {
    if (!deepLinked) return
    setSelectedTaxonomyId(deepLinked)
    setView(canManage ? 'editor' : 'read')
    const next = new URLSearchParams(searchParams)
    next.delete('taxonomy')
    setSearchParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinked, canManage])

  const selected = activeScripts.find((s) => s.taxonomyId === selectedTaxonomyId) ?? activeScripts[0] ?? null
  // The first course is the one merge fields use — managers want to see real
  // numbers, and a tenant's first active course is the one they sell most.
  const previewCourse = courses.courses[0] ?? null

  if (displayState === 'loading' || library.loading) return <LoadingGrid />
  if (displayState === 'error') {
    return (
      <ErrorState
        title="Couldn't load the Playbook"
        body="Your scripts are still safe. Check the connection and retry."
        onRetry={library.reload}
      />
    )
  }
  if (library.error) {
    return <ErrorState title="Couldn't load the Playbook" body={library.error} onRetry={library.reload} />
  }

  const reloadAll = () => {
    void library.reload()
    void winRates.reload()
  }

  const tabs: { key: PlaybookView; label: string; icon: typeof Library }[] = canManage
    ? [
        { key: 'library', label: 'Library', icon: Library },
        { key: 'editor', label: 'Editor', icon: PenLine },
        { key: 'taxonomy', label: 'Taxonomy', icon: Merge },
        { key: 'settings', label: 'Settings', icon: SlidersHorizontal },
        { key: 'courses', label: 'Courses', icon: GraduationCap },
        { key: 'read', label: 'Read', icon: BookOpen },
      ]
    : [{ key: 'read', label: 'The Playbook', icon: BookOpen }]

  return (
    <div>
      {/* At 390 the fifth tab was cut mid-word to "Settin…" with no scrollbar
          and no fade, so nothing said the row continued. Five short labels wrap
          onto two lines comfortably; a scroll affordance would only be needed
          if they could not. */}
      <div className="mb-4 flex flex-wrap gap-1 border-b border-border" role="tablist" aria-label="Playbook sections">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={view === tab.key}
            onClick={() => setView(tab.key)}
            className={[
              'flex min-h-11 shrink-0 items-center gap-1.5 border-b-2 px-3 text-xs font-semibold',
              view === tab.key ? 'border-accent text-fg' : 'border-transparent text-fg-muted hover:text-fg',
            ].join(' ')}
          >
            <tab.icon aria-hidden size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {view === 'library' && (
        <LibraryView
          scripts={activeScripts}
          rates={winRates.rates}
          offered={salesConfig.config.languages}
          onEdit={(script) => {
            setSelectedTaxonomyId(script.taxonomyId)
            setView('editor')
          }}
        />
      )}

      {view === 'editor' &&
        (selected ? (
          <EditorView
            key={selected.taxonomyId}
            clientId={clientId}
            actorId={actorId}
            script={selected}
            allScripts={activeScripts}
            offered={salesConfig.config.languages}
            course={previewCourse}
            clientName={activeClient?.name ?? null}
            onSelectTaxonomy={setSelectedTaxonomyId}
            onLibraryChange={reloadAll}
          />
        ) : (
          <EmptyState
            icon={PenLine}
            title="Nothing in the taxonomy yet."
            body="Add a stage or an objection from the Taxonomy tab, then come back to write its first script."
          />
        ))}

      {view === 'taxonomy' && (
        <TaxonomyView
          clientId={clientId}
          actorId={actorId}
          canManage={canManage}
          taxonomy={library.taxonomy}
          scripts={library.scripts}
          onChanged={reloadAll}
        />
      )}

      {view === 'settings' && (
        <SettingsView
          clientId={clientId}
          config={salesConfig.config}
          setConfig={salesConfig.setConfig}
          reload={salesConfig.reload}
          scripts={library.scripts}
          course={previewCourse}
          clientName={activeClient?.name ?? null}
        />
      )}

      {view === 'courses' && (
        <CoursesView courses={courses.courses} scripts={library.scripts} onSaved={courses.reload} />
      )}

      {view === 'read' && (
        <ReadView
          clientId={clientId}
          userId={actorId}
          scripts={library.scripts}
          rates={winRates.rates}
          spins={spins.spins}
          languages={salesConfig.config.languages}
          defaultLang={salesConfig.config.defaultLang}
          onSpinChanged={spins.reload}
        />
      )}
    </div>
  )
}
