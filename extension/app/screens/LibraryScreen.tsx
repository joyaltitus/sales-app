import { useEffect, useMemo, useState } from 'react'
import { queueWrite } from '../../lib/outbox-store'
import { spinsFor, usePlaybookLibrary, type PanelIdentity } from '../../lib/panel-data'
import {
  COMPOSED_FROM, DEFAULT_LANG, highlighted, resolveParagraphs, toText, type PickedScript,
} from '../../lib/script-text'
import { pickScript } from '../../lib/script-text'
import { loadPrefs, savePrefs } from '../../lib/prefs'
import { renderSnippet } from '../../lib/snippet'
import type { Rebuttal } from '../../lib/contracts'
import { LibrarySkeleton } from '../../ui/Skeletons'
import { PlaybookIcon, WinRateChip } from '../../ui/ObjectionChips'
import { ScriptSheet } from '../../ui/ScriptSheet'
import { insertWithFallback } from '../../ui/SnippetBar'
import { StaleChip } from '../../ui/StaleChip'
import { Chip } from '../../../src/ui/Chip'
import { EmptyState } from '../../../src/ui/EmptyState'
import { ErrorState } from '../../../src/ui/ErrorState'
import { Input } from '../../../src/ui/Input'

type Group = { title: string; scripts: Rebuttal[] }

/** Three groups, because a rep looks for a script in exactly three ways: where
 *  am I in the call, what did they just say, and what do I have to send. */
function group(scripts: Rebuttal[]): Group[] {
  const active = scripts.filter((script) => script.status === 'active')
  const roadmap = active.filter((s) => s.kind === 'stage' && s.position < COMPOSED_FROM)
  const composed = active.filter((s) => s.kind === 'stage' && s.position >= COMPOSED_FROM)
  const objections = active.filter((s) => s.kind === 'objection')
  const byPosition = (a: Rebuttal, b: Rebuttal) => a.position - b.position || a.label.localeCompare(b.label)
  return [
    { title: 'Call roadmap', scripts: roadmap.sort(byPosition) },
    { title: 'Objections', scripts: objections.sort(byPosition) },
    { title: 'Composed texts', scripts: composed.sort(byPosition) },
  ].filter((entry) => entry.scripts.length > 0)
}

export default function LibraryScreen({ identity }: { identity: PanelIdentity }) {
  const library = usePlaybookLibrary(identity.clientId, identity.userId)
  const [lang, setLang] = useState(DEFAULT_LANG)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<Rebuttal | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  // The dialect chips are the same preference the HUD uses: a rep who reads
  // Manglish mid-call reads Manglish here too.
  useEffect(() => {
    let alive = true
    void loadPrefs().then((prefs) => {
      if (alive) setLang(prefs.defaultLang ?? library.config?.default_lang ?? DEFAULT_LANG)
    })
    return () => { alive = false }
  }, [library.config?.default_lang])

  // No lead and no course on this screen, so course tokens stay visible — which
  // is right: the Library shows the script, not one customer's version of it.
  const vars = useMemo(
    () => ({ rep: identity.displayName, 'client.name': identity.clientName }),
    [identity.clientName, identity.displayName],
  )

  const langs = useMemo(() => {
    const found = new Set<string>()
    for (const script of library.scripts) for (const code of script.langs) found.add(code)
    const allowed = library.config?.languages
    const base = library.config?.default_lang ?? DEFAULT_LANG
    const list = [...found].filter((code) => !allowed?.length || allowed.includes(code))
    if (!list.includes(base)) list.unshift(base)
    return list
  }, [library.config, library.scripts])

  const groups = useMemo(() => {
    const term = query.trim().toLowerCase()
    const matches = (script: Rebuttal) =>
      !term
      || script.label.toLowerCase().includes(term)
      || toText(resolveParagraphs(script.body, lang).paragraphs).toLowerCase().includes(term)
    return group(library.scripts.filter(matches))
  }, [lang, library.scripts, query])

  if (library.loading) return <main><LibrarySkeleton /></main>
  if (library.error) {
    return (
      <main>
        <ErrorState title="Couldn’t load the library" body="Check your connection, then retry." onRetry={() => void library.reload()} />
      </main>
    )
  }
  if (library.scripts.length === 0) {
    return <EmptyState title="No scripts yet" body="Your manager’s approved scripts will appear here." />
  }

  async function saveSpin(script: Rebuttal, spinLang: string, body: string) {
    if (!script.script_id) return
    await queueWrite('save_spin', {
      client_id: identity.clientId, script_id: script.script_id, lang: spinLang,
      title: script.label, body, created_by: identity.userId,
    })
    setMessage('Saved your version.')
  }

  return (
    <main className="space-y-3 p-3">
      {library.staleAt && <StaleChip fetched_at={library.staleAt} />}
      <Input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search scripts…"
        aria-label="Search scripts"
        className="min-h-11"
      />
      {langs.length > 1 && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Dialect">
          {langs.map((code) => (
            <button
              key={code}
              type="button"
              aria-pressed={code === lang}
              onClick={() => { setLang(code); void savePrefs({ defaultLang: code }) }}
              className={[
                'min-h-11 rounded-pill border px-3 text-xs font-medium transition-colors',
                code === lang
                  ? 'border-accent bg-accent-subtle text-accent'
                  : 'border-border bg-surface-raised text-fg-muted hover:border-border-strong hover:text-fg',
              ].join(' ')}
            >
              {code.toUpperCase()}
            </button>
          ))}
        </div>
      )}
      {message && <p role="status" className="rounded-md border border-border bg-surface-sunk px-3 py-2 text-xs text-fg-muted">{message}</p>}

      {groups.length === 0 ? (
        <EmptyState title="No script matches" body="Try a shorter search." />
      ) : groups.map((entry) => (
        <section key={entry.title} className="space-y-1.5">
          <h2 className="label-caps">{entry.title}</h2>
          {entry.scripts.map((script) => {
            const picked: PickedScript = pickScript(script, lang, false, spinsFor(library.spins, script.script_id))
            const custom = library.spins.some((spin) => spin.script_id === script.script_id)
            return (
              <button
                key={script.taxonomy_id}
                type="button"
                onClick={() => setOpen(script)}
                className="flex w-full min-w-0 flex-col items-start gap-1 rounded-lg border border-border bg-surface-raised px-3 py-2.5 text-left shadow-elev-1 transition-colors hover:border-border-strong hover:bg-surface"
              >
                <span className="flex w-full min-w-0 items-center gap-1.5">
                  <PlaybookIcon name={script.icon} size={13} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-fg">{script.label}</span>
                  {custom && <Chip tone="neutral">Custom</Chip>}
                  <WinRateChip script={script} />
                </span>
                <span className="line-clamp-2 w-full text-xs leading-relaxed break-words text-fg-muted">
                  {picked.paragraphs[0] ? highlighted(picked.paragraphs[0], vars) : 'No approved copy yet.'}
                </span>
              </button>
            )
          })}
        </section>
      ))}

      {open && (
        <ScriptSheet
          script={open}
          onClose={() => setOpen(null)}
          langs={langs}
          lang={lang}
          onLang={(code) => { setLang(code); void savePrefs({ defaultLang: code }) }}
          vars={vars}
          spins={spinsFor(library.spins, open.script_id)}
          canEditStandard={identity.role === 'manager' || identity.role === 'client_admin'}
          onSaveSpin={(spinLang, body) => void saveSpin(open, spinLang, body)}
          onResetSpin={(spinLang) => {
            if (!open.script_id) return
            void queueWrite('delete_spin', {
              client_id: identity.clientId, script_id: open.script_id, lang: spinLang, created_by: identity.userId,
            }).then(() => setMessage('Back to the company standard.'))
          }}
          onInsert={(text) => void insertWithFallback(
            renderSnippet(text, { rep: identity.displayName, 'client.name': identity.clientName }),
          ).then(setMessage)}
        />
      )}
    </main>
  )
}
