import { useMemo, useState } from 'react'
import { Mic, PenLine } from 'lucide-react'
import { Button } from '../../ui/Button'
import { Chip } from '../../ui/Chip'
import { useClient } from '../../shell/ClientProvider'
import { useAuth } from '../../auth/AuthProvider'
import { useScriptLibrary } from '../../lib/scripts-data'
import type { LibraryScript } from '../../lib/scripts-data'
import { resolveParagraphs } from '../../lib/script-body'
import { spinIsStale, useSalesConfig, useSpins } from '../../lib/sales-settings-data'
import { ScriptText, langLabel, useDialectPreference } from '../docs/playbook/shared'
import { SpinSheet } from '../docs/playbook/ReadView'

// "My script voice" — the rep's own wording for each company standard, per
// dialect. Real, not a preview card: it writes personal quick_replies pinned to
// a script (068), so the same words also show up in the composer's snippet
// picker without a second place to edit them.

function ScriptRow({
  script,
  lang,
  spinBody,
  spinUpdatedAt,
  onEdit,
}: {
  script: LibraryScript
  lang: string
  spinBody: string | undefined
  spinUpdatedAt: string | undefined
  onEdit: () => void
}) {
  const version = script.current!
  const { paragraphs, fallback } = resolveParagraphs(version.body, lang)
  const stale = spinUpdatedAt ? spinIsStale(version.createdAt, spinUpdatedAt) : false

  return (
    <div className="border-b border-border p-4 last:border-0">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="min-w-0 flex-1 truncate text-xs font-semibold text-fg">{script.taxonomyLabel}</h4>
        {spinBody && <Chip tone="accent">Custom</Chip>}
        {fallback && <Chip tone="neutral" title={`Not written in ${langLabel(lang)} yet`}>EN</Chip>}
        {stale && <Chip tone="warn">Standard changed since your spin</Chip>}
      </div>

      <div className="mt-2 rounded-lg border border-border bg-surface-sunk p-3">
        <p className="label-caps mb-1.5">The company version</p>
        <ScriptText paragraphs={paragraphs} />
      </div>

      {spinBody && (
        <div className="mt-2 rounded-lg border border-[color-mix(in_srgb,var(--accent)_22%,var(--border))] bg-accent-subtle p-3">
          <p className="label-caps mb-1.5 text-accent">Your version</p>
          <p className="text-sm leading-7 whitespace-pre-line text-fg-muted">{spinBody}</p>
        </div>
      )}

      <Button variant="secondary" size="sm" className="mt-2.5" onClick={onEdit}>
        <PenLine aria-hidden size={13} /> {spinBody ? 'Edit my version' : 'Say it my way'}
      </Button>
    </div>
  )
}

export function ScriptVoiceSection({ show }: { show: (label: string) => boolean }) {
  const { activeClient } = useClient()
  const { session } = useAuth()
  const clientId = activeClient?.id ?? null
  const userId = session?.user.id ?? null

  const library = useScriptLibrary(clientId)
  const config = useSalesConfig(clientId)
  const spins = useSpins(clientId, userId)
  const [lang, setLang] = useDialectPreference(config.config.defaultLang)
  const [editing, setEditing] = useState<LibraryScript | null>(null)

  // A spin whose script's taxonomy was archived is HIDDEN, never deleted — the
  // tag may come back, and destroying a rep's own words on a governance change
  // would be the worst possible trade.
  const standards = useMemo(
    () =>
      library.scripts.filter(
        (s) => s.taxonomyStatus === 'active' && s.current?.status === 'standard' && s.scriptId,
      ),
    [library.scripts],
  )

  if (!show('my script voice spin dialect wording')) return null

  const spinFor = (script: LibraryScript) => spins.spins.find((s) => s.scriptId === script.scriptId && s.lang === lang)

  return (
    <article className="overflow-hidden rounded-xl border border-border bg-surface shadow-elev-1">
      <header className="flex flex-wrap items-center gap-3 border-b border-border p-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-subtle text-accent">
          <Mic aria-hidden size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-fg">My script voice</h3>
          <p className="mt-0.5 text-2xs text-fg-muted">
            The company version stays the standard. This is how <em>you</em> say it.
          </p>
        </div>
      </header>

      <div className="flex flex-wrap gap-1 border-b border-border bg-surface-sunk px-3 py-2" role="group" aria-label="Dialect">
        {config.config.languages.map((code) => (
          <button
            key={code}
            onClick={() => setLang(code)}
            aria-pressed={lang === code}
            className={[
              'min-h-8 rounded-md px-3 text-xs font-semibold',
              lang === code ? 'bg-accent-subtle text-accent' : 'text-fg-muted hover:text-fg',
            ].join(' ')}
          >
            {langLabel(code)}
          </button>
        ))}
      </div>

      {library.loading ? (
        <p className="px-4 py-6 text-xs text-fg-muted">Loading your playbook…</p>
      ) : standards.length ? (
        <div>
          {standards.map((script) => {
            const spin = spinFor(script)
            return (
              <ScriptRow
                key={script.taxonomyId}
                script={script}
                lang={lang}
                spinBody={spin?.body}
                spinUpdatedAt={spin?.updatedAt}
                onEdit={() => setEditing(script)}
              />
            )
          })}
        </div>
      ) : (
        <p className="px-4 py-6 text-xs text-fg-muted">
          No company standards yet. Once your manager promotes one it shows up here to make your own.
        </p>
      )}

      {editing && (
        <SpinSheet
          key={`${editing.taxonomyId}-${lang}`}
          open
          onClose={() => setEditing(null)}
          clientId={clientId}
          userId={userId}
          script={editing}
          lang={lang}
          spin={spinFor(editing)}
          onSaved={spins.reload}
        />
      )}
    </article>
  )
}
