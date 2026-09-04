import { useEffect, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import type { PersonalSpin, Rebuttal } from '../lib/contracts'
import { highlighted, resolveParagraphs, toText, winRateLabel } from '../lib/script-text'
import { hubPlaybookUrl } from '../lib/panel-client'
import { Sheet } from '../../src/ui/Sheet'
import { Button } from '../../src/ui/Button'
import { Chip } from '../../src/ui/Chip'

export const MAX_SPIN_CHARS = 1500

type Props = {
  script: Rebuttal | null
  onClose: () => void
  langs: string[]
  lang: string
  onLang: (lang: string) => void
  /** Merge values, so the preview reads exactly like the composer will. */
  vars: Record<string, string>
  /** The viewer's spins for THIS script, keyed by dialect. */
  spins: ReadonlyMap<string, PersonalSpin>
  /** Managers and client_admins edit the standard — in Sales Hub, never here. */
  canEditStandard: boolean
  onSaveSpin: (lang: string, body: string) => void
  onResetSpin: (lang: string) => void
  onInsert: (text: string) => void
  busy?: boolean
}

/**
 * One script, in full.
 *
 * Two sections that are never confused for each other: the company standard,
 * which the rep can read and copy but not change, and the rep's own spin, which
 * only they can see. The extension has no editor for the standard by design —
 * a script the whole team says is not a thing to rewrite between two calls.
 */
export function ScriptSheet({
  script, onClose, langs, lang, onLang, vars, spins, canEditStandard, onSaveSpin, onResetSpin, onInsert, busy = false,
}: Props) {
  const spin = spins.get(lang) ?? null
  const [draft, setDraft] = useState(spin?.body ?? '')

  // The textarea follows the dialect tabs: switching to Manglish while the
  // English draft is still in the box would save English text under 'mn'.
  useEffect(() => { setDraft(spins.get(lang)?.body ?? '') }, [lang, script?.taxonomy_id, spins])

  if (!script) return null
  const standard = resolveParagraphs(script.body, lang)
  const stale = Boolean(spin && script.created_at && script.created_at > spin.updated_at)
  const dirty = draft.trim() !== (spin?.body ?? '').trim()
  const tooLong = draft.length > MAX_SPIN_CHARS

  return (
    <Sheet open onClose={onClose} title={script.label}>
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {script.version !== null && <Chip tone="accent">v{script.version}</Chip>}
          <Chip tone={script.rated >= 10 ? 'success' : 'neutral'}>
            {winRateLabel(script.rated, script.won)}
          </Chip>
          <span className="text-2xs text-fg-subtle tnum">{script.rated} rated · {script.uses} uses</span>
        </div>

        {langs.length > 1 && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Dialect">
            {langs.map((code) => (
              <button
                key={code}
                type="button"
                aria-pressed={code === lang}
                onClick={() => onLang(code)}
                className={[
                  'min-h-9 rounded-pill border px-3 text-xs font-medium transition-colors',
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

        <section aria-label="Company standard" className="min-w-0">
          <div className="mb-1 flex items-center gap-2">
            <h3 className="label-caps">Company standard</h3>
            {standard.fallback && <Chip tone="warn">{standard.lang.toUpperCase()} — no {lang.toUpperCase()} yet</Chip>}
          </div>
          {standard.paragraphs.length === 0 ? (
            <p className="text-xs text-fg-subtle">Nothing written for this one yet.</p>
          ) : (
            <div className="space-y-1.5 rounded-md border border-border bg-surface-sunk p-2.5">
              {standard.paragraphs.map((paragraph, index) => (
                <p key={index} className="text-xs leading-relaxed break-words text-fg-muted">{highlighted(paragraph, vars)}</p>
              ))}
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="min-h-11"
              disabled={busy || standard.paragraphs.length === 0}
              onClick={() => onInsert(toText(standard.paragraphs))}
            >
              Insert standard
            </Button>
            {canEditStandard ? (
              <a
                href={hubPlaybookUrl(script.taxonomy_id)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center gap-1 text-xs font-medium text-accent hover:underline"
              >
                Edit company standard in Sales Hub
                <ExternalLink aria-hidden size={12} strokeWidth={2} />
              </a>
            ) : (
              <span className="text-2xs text-fg-subtle">Company standard is edited by your manager in Sales Hub.</span>
            )}
          </div>
        </section>

        <section aria-label="My spin" className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h3 className="label-caps">My spin ({lang.toUpperCase()})</h3>
            {stale && <Chip tone="warn">Standard changed since your spin</Chip>}
          </div>
          <textarea
            value={draft}
            disabled={busy}
            onChange={(event) => setDraft(event.target.value)}
            rows={5}
            aria-label={`My spin in ${lang}`}
            placeholder="Say it the way you actually say it…"
            className="w-full resize-none rounded-md border border-border bg-surface-raised px-3 py-2 text-xs leading-relaxed text-fg placeholder:text-fg-subtle focus:bg-surface disabled:opacity-60"
          />
          <div className="mt-1 flex items-center gap-2">
            <span className={['text-2xs tnum', tooLong ? 'text-danger' : 'text-fg-subtle'].join(' ')}>
              {draft.length}/{MAX_SPIN_CHARS}
            </span>
            <div className="ml-auto flex gap-1.5">
              {spin && (
                <Button variant="ghost" size="sm" className="min-h-11" disabled={busy} onClick={() => onResetSpin(lang)}>
                  Reset
                </Button>
              )}
              <Button
                variant="primary"
                size="sm"
                className="min-h-11"
                disabled={busy || !dirty || tooLong || draft.trim() === ''}
                onClick={() => onSaveSpin(lang, draft.trim())}
              >
                Save
              </Button>
            </div>
          </div>
          {/* The same merge tokens run through a spin as through the standard,
              so {{course.fee}} in the rep's own wording still fills. */}
          <p className="mt-1 text-2xs text-fg-subtle">
            Only you see this. Tokens like <code>{'{{course.fee}}'}</code> still fill in.
          </p>
        </section>
      </div>
    </Sheet>
  )
}
