import { useMemo, useRef } from 'react'
import { Copy, Plus } from 'lucide-react'
import { Button } from '../../../ui/Button'
import { parseAuthoring, renderMerged, toAuthoring } from '../../../lib/script-body'
import type { ScriptBody, ScriptParagraph } from '../../../lib/script-body'
import { MERGE_TOKENS, ScriptText, insertAtCaret, langLabel } from './shared'

// The authoring surface itself: dialect tabs, the textarea, the merge-token
// palette and the live preview. Extracted from EditorView because the weekly
// teardown embeds exactly this — a manager fixing a losing script in the
// meeting should not get a different editor from the one in the Playbook.

export const BASE_LANG = 'en'

export type Drafts = Record<string, string>

export function draftsFromBody(body: ScriptBody | null | undefined): Drafts {
  const drafts: Drafts = { [BASE_LANG]: toAuthoring(body?.paragraphs) }
  for (const [lang, variant] of Object.entries(body?.variants ?? {})) {
    drafts[lang] = toAuthoring(variant.paragraphs)
  }
  return drafts
}

export function bodyFromDrafts(drafts: Drafts): ScriptBody {
  const variants: Record<string, { paragraphs: ScriptParagraph[] }> = {}
  for (const [lang, text] of Object.entries(drafts)) {
    if (lang === BASE_LANG) continue
    const paragraphs = parseAuthoring(text)
    // An empty dialect tab is an ABSENT variant, not an empty one — otherwise
    // resolveParagraphs would "find" it and show the rep a blank script.
    if (paragraphs.length) variants[lang] = { paragraphs }
  }
  return { paragraphs: parseAuthoring(drafts[BASE_LANG] ?? ''), lang: BASE_LANG, variants }
}

export function DialectEditor({
  drafts,
  setDrafts,
  lang,
  setLang,
  tabs,
  offered,
  vars,
  courseName,
  onAddLanguage,
  compact = false,
}: {
  drafts: Drafts
  setDrafts: (next: Drafts | ((all: Drafts) => Drafts)) => void
  lang: string
  setLang: (lang: string) => void
  tabs: string[]
  offered: string[]
  vars: Record<string, unknown>
  courseName: string | null
  onAddLanguage?: (code: string) => void
  /** Teardown stacks the preview under the textarea; the Playbook puts it
   *  beside. Same component either way. */
  compact?: boolean
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const setDraft = (value: string) => setDrafts((all) => ({ ...all, [lang]: value }))

  const previewParagraphs = useMemo(
    () => renderMerged(parseAuthoring(drafts[lang] ?? ''), vars),
    [drafts, lang, vars],
  )

  return (
    <div>
      {/* Arrow keys move between dialects — the editor is reachable without a
          mouse, which is the whole point during a live teardown. */}
      <div className="flex items-center gap-1 border-b border-border">
        <div
          className="flex min-w-0 flex-1 gap-1 overflow-x-auto"
          role="tablist"
          aria-label="Dialect"
          onKeyDown={(event) => {
            if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
            event.preventDefault()
            const i = tabs.indexOf(lang)
            setLang(tabs[(i + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length])
          }}
        >
        {tabs.map((code) => {
          const isOffered = offered.includes(code) || code === BASE_LANG
          const written = (drafts[code] ?? '').trim().length > 0
          return (
            <button
              key={code}
              role="tab"
              aria-selected={lang === code}
              tabIndex={lang === code ? 0 : -1}
              onClick={() => setLang(code)}
              title={isOffered ? undefined : 'Not offered by this workspace any more — the text is kept'}
              className={[
                'flex min-h-10 shrink-0 items-center gap-1.5 border-b-2 px-3 text-xs font-semibold',
                lang === code ? 'border-accent text-fg' : 'border-transparent text-fg-muted hover:text-fg',
                isOffered ? '' : 'opacity-50',
              ].join(' ')}
            >
              {langLabel(code)}
              <span
                aria-hidden
                className={['h-1.5 w-1.5 rounded-pill', written ? 'bg-accent' : 'bg-border-strong'].join(' ')}
              />
              {!isOffered && <span className="text-2xs font-normal">not offered</span>}
            </button>
          )
        })}
        </div>
        {onAddLanguage && (
          <button
            onClick={() => {
              const code = window.prompt('Language code to add (e.g. ta, kn)')?.trim().toLowerCase()
              if (code && !tabs.includes(code)) onAddLanguage(code)
            }}
            className="flex min-h-10 shrink-0 items-center gap-1 px-3 text-xs font-semibold text-fg-muted hover:text-fg"
          >
            <Plus aria-hidden size={13} /> language
          </button>
        )}
      </div>

      <div className={compact ? 'mt-3 space-y-3' : 'mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]'}>
        <section className="min-w-0">
          {lang !== BASE_LANG && (
            <div className="mb-1.5 flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-2xs"
                onClick={() => setDrafts((all) => ({ ...all, [lang]: all[BASE_LANG] ?? '' }))}
              >
                <Copy aria-hidden size={12} /> Copy from English
              </Button>
            </div>
          )}
          <textarea
            ref={textareaRef}
            value={drafts[lang] ?? ''}
            onChange={(event) => setDraft(event.target.value)}
            aria-label={`${langLabel(lang)} script draft`}
            placeholder={'Blank line starts a new paragraph.\nWrap the line that matters in **double asterisks**.'}
            className={[
              'w-full resize-y rounded-lg border border-border bg-surface-raised p-4 text-sm leading-7 text-fg shadow-[var(--inset-highlight)]',
              compact ? 'min-h-40' : 'min-h-64',
            ].join(' ')}
          />
          <div className="mt-3">
            <p className="label-caps mb-1.5">Insert a value</p>
            <div className="flex flex-wrap gap-1.5">
              {MERGE_TOKENS.map((item) => (
                <button
                  key={item.token}
                  title={item.hint}
                  onClick={() => insertAtCaret(textareaRef.current, item.token, setDraft)}
                  className="rounded-md border border-border bg-surface-sunk px-2 py-1 text-2xs font-semibold text-fg-muted hover:border-border-strong hover:text-fg"
                >
                  {item.token}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="min-w-0">
          <p className="label-caps mb-2">As the rep sees it</p>
          <div className="max-w-[380px] rounded-lg border border-border bg-surface-sunk p-4">
            <ScriptText paragraphs={previewParagraphs} />
          </div>
          <p className="mt-2 text-2xs text-fg-subtle">
            {courseName ? `Real values from ${courseName}.` : 'No course facts yet — add one in Courses.'} Underlined
            words have no value set.
          </p>
        </section>
      </div>
    </div>
  )
}
