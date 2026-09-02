import { useMemo, useState } from 'react'
import { BookOpen, PenLine } from 'lucide-react'
import { Button } from '../../../ui/Button'
import { Chip } from '../../../ui/Chip'
import { EmptyState } from '../../../ui/EmptyState'
import { Sheet } from '../../../ui/Sheet'
import { COMPOSED_FROM_POSITION } from '../../../lib/scripts-data'
import type { LibraryScript, WinRate } from '../../../lib/scripts-data'
import { resolveParagraphs } from '../../../lib/script-body'
import { SPIN_MAX_CHARS, deleteSpin, spinIsStale, spinSeedText, upsertSpin } from '../../../lib/sales-settings-data'
import type { Spin } from '../../../lib/sales-settings-data'
import { ScriptText, WinRateChip, langLabel, useDialectPreference } from './shared'

// The rep's reading view: the roadmap in call order, then the objections. Every
// script can carry the rep's OWN version of it — same editor as the settings
// panel, because a rep should be able to make a line theirs from wherever they
// are reading it.

export function SpinSheet({
  open,
  onClose,
  clientId,
  userId,
  script,
  lang,
  spin,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  clientId: string | null
  userId: string | null
  script: LibraryScript | null
  lang: string
  spin: Spin | undefined
  onSaved: () => void
}) {
  const seed = spin?.body ?? spinSeedText(script?.current?.body, lang)
  const [text, setText] = useState(seed)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const over = text.trim().length > SPIN_MAX_CHARS

  const save = async () => {
    if (!clientId || !userId || !script?.scriptId) return
    setBusy(true)
    setError(null)
    const result = await upsertSpin({
      clientId,
      userId,
      scriptId: script.scriptId,
      lang,
      title: script.taxonomyLabel,
      body: text,
    })
    setBusy(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    onSaved()
    onClose()
  }

  const reset = async () => {
    if (!clientId || !spin) return
    setBusy(true)
    setError(null)
    const result = await deleteSpin(clientId, spin.id)
    setBusy(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    onSaved()
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title={script ? `My words · ${script.taxonomyLabel}` : 'My words'}>
      <p className="text-xs leading-relaxed text-fg-muted">
        The company standard stays the standard. This is the version{' '}
        <strong className="font-semibold text-fg">you</strong> say, in {langLabel(lang)}. Merge values like{' '}
        <code className="rounded-sm bg-surface-sunk px-1">{'{{name}}'}</code> still work.
      </p>

      {error && (
        <p role="alert" className="mt-3 rounded-md bg-danger-subtle px-3 py-2 text-xs text-danger">
          {error}
        </p>
      )}

      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        aria-label="My version of this script"
        className="mt-3 min-h-56 w-full resize-y rounded-lg border border-border bg-surface-raised p-3 text-sm leading-7 text-fg"
      />
      <p className={['tnum mt-1 text-2xs', over ? 'text-danger' : 'text-fg-subtle'].join(' ')}>
        {text.trim().length} / {SPIN_MAX_CHARS}
      </p>

      <div className="mt-4 flex gap-2">
        {spin && (
          <Button variant="ghost" onClick={() => void reset()} disabled={busy}>
            Reset to standard
          </Button>
        )}
        <Button className="ml-auto" onClick={() => void save()} disabled={busy || over || !text.trim()}>
          {busy ? 'Saving…' : 'Save my version'}
        </Button>
      </div>
    </Sheet>
  )
}

function ReadSection({
  script,
  index,
  lang,
  rate,
  spin,
  onEditSpin,
}: {
  script: LibraryScript
  index: number | null
  lang: string
  rate: WinRate | undefined
  spin: Spin | undefined
  onEditSpin: () => void
}) {
  const version = script.current!
  const { paragraphs, fallback } = resolveParagraphs(version.body, lang)
  const stale = spin ? spinIsStale(version.createdAt, spin.updatedAt) : false

  return (
    <section className="grid gap-5 px-6 py-8 sm:grid-cols-[90px_minmax(0,1fr)] sm:px-10">
      <div>
        {index !== null && (
          <span className="tnum text-3xl font-semibold tracking-[-0.05em] text-border-strong">
            {String(index).padStart(2, '0')}
          </span>
        )}
        <p className="label-caps mt-2">{script.taxonomyLabel}</p>
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-semibold tracking-[-0.03em] text-fg">{version.headline ?? script.taxonomyLabel}</h3>
          <WinRateChip rate={rate} />
          {fallback && <Chip tone="neutral" title={`Not written in ${langLabel(lang)} yet — showing English`}>EN</Chip>}
          {spin && <Chip tone="accent">Your words</Chip>}
          {stale && <Chip tone="warn">Standard changed since your version</Chip>}
        </div>

        <div className="mt-4">
          <ScriptText paragraphs={spin ? [{ before: spin.body }] : paragraphs} />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-3 text-2xs text-fg-subtle">
          <span>Standard v{version.version}</span>
          <span aria-hidden>•</span>
          <span>{version.createdByName ?? 'Unknown'}</span>
          <Button variant="ghost" size="sm" className="ml-auto h-7 px-2 text-2xs" onClick={onEditSpin}>
            <PenLine aria-hidden size={12} /> {spin ? 'Edit my words' : 'Say it my way'}
          </Button>
        </div>
      </div>
    </section>
  )
}

export function ReadView({
  clientId,
  userId,
  scripts,
  rates,
  spins,
  languages,
  defaultLang,
  onSpinChanged,
}: {
  clientId: string | null
  userId: string | null
  scripts: LibraryScript[]
  rates: Map<string, WinRate>
  spins: Spin[]
  languages: string[]
  defaultLang: string
  onSpinChanged: () => void
}) {
  const [lang, setLang] = useDialectPreference(defaultLang)
  const [editing, setEditing] = useState<LibraryScript | null>(null)

  const standards = useMemo(() => scripts.filter((s) => s.current?.status === 'standard'), [scripts])
  const roadmap = standards.filter((s) => s.kind === 'stage' && s.position < COMPOSED_FROM_POSITION)
  const rest = standards.filter((s) => !(s.kind === 'stage' && s.position < COMPOSED_FROM_POSITION))
  const spinFor = (script: LibraryScript) =>
    spins.find((s) => s.scriptId === script.scriptId && s.lang === lang)

  return (
    <article className="mx-auto max-w-4xl overflow-hidden rounded-xl border border-border bg-surface shadow-elev-2">
      <header className="relative overflow-hidden border-b border-border px-6 py-10 sm:px-10 sm:py-12">
        <span
          aria-hidden
          className="absolute top-0 right-0 text-[120px] leading-none font-bold tracking-[-0.08em] text-surface-sunk"
        >
          P
        </span>
        <div className="relative">
          <p className="label-caps text-accent">Your field guide</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.055em] text-fg">The Playbook</h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-fg-muted">
            Listen fully. Name the real concern. Start from the company's strongest line — then say it like you.
          </p>
          <div className="mt-4 flex flex-wrap gap-1" role="group" aria-label="Dialect">
            {languages.map((code) => (
              <button
                key={code}
                onClick={() => setLang(code)}
                aria-pressed={lang === code}
                className={[
                  'min-h-9 rounded-md px-3 text-xs font-semibold',
                  lang === code ? 'bg-accent-subtle text-accent' : 'text-fg-muted hover:bg-surface-sunk hover:text-fg',
                ].join(' ')}
              >
                {langLabel(code)}
              </button>
            ))}
          </div>
        </div>
      </header>

      {standards.length ? (
        <div className="divide-y divide-border">
          {roadmap.map((script, i) => (
            <ReadSection
              key={script.taxonomyId}
              script={script}
              index={i + 1}
              lang={lang}
              rate={rates.get(script.current!.id)}
              spin={spinFor(script)}
              onEditSpin={() => setEditing(script)}
            />
          ))}
          {rest.map((script) => (
            <ReadSection
              key={script.taxonomyId}
              script={script}
              index={null}
              lang={lang}
              rate={rates.get(script.current!.id)}
              spin={spinFor(script)}
              onEditSpin={() => setEditing(script)}
            />
          ))}
        </div>
      ) : (
        <div className="px-6 py-10 sm:px-10">
          <EmptyState
            icon={BookOpen}
            title="No standard scripts yet."
            body="Once a manager promotes a tested version it appears here, in every dialect it carries."
          />
        </div>
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
          onSaved={onSpinChanged}
        />
      )}
    </article>
  )
}
