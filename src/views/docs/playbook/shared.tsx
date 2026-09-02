import { useCallback, useEffect, useState } from 'react'
import { Chip } from '../../../ui/Chip'
import type { ScriptParagraph, ScriptStatus, WinRate } from '../../../lib/scripts-data'

// Pieces every Playbook tab needs. Kept in one place so the library card, the
// editor preview, the read view and the teardown all say the same thing about
// the same numbers — the whole point of a company standard.

export const STATUS_TONE: Record<ScriptStatus, 'neutral' | 'warn' | 'success'> = {
  draft: 'neutral',
  testing: 'warn',
  standard: 'success',
}

/** Display names for the dialect codes the demo tenant ships with. A code with
 *  no entry falls back to its own uppercase — languages are DATA (hard law 3),
 *  so an unknown code must still render, never crash or read as "undefined". */
const LANG_LABELS: Record<string, string> = {
  en: 'English',
  mn: 'Manglish',
  hi: 'Hindi',
  ta: 'Tamil',
  te: 'Telugu',
  kn: 'Kannada',
  ml: 'Malayalam',
}

export function langLabel(code: string): string {
  return LANG_LABELS[code] ?? code.toUpperCase()
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** Below this many rated uses a percentage is noise, so the UI says "early"
 *  and shows the count instead. A version used 40 times and rated twice does
 *  not have a 50% win rate. */
export const RATED_FOR_PERCENT = 10

export type WinRateLabel = { text: string; tone: 'neutral' | 'success' | 'warn'; title: string }

export function winRateLabel(rate: WinRate | undefined): WinRateLabel {
  if (!rate || rate.rated === 0) {
    return {
      text: 'untested',
      tone: 'neutral',
      title: rate?.uses ? `Used ${rate.uses} times, never rated worked/didn't` : 'Never used on a call yet',
    }
  }
  if (rate.rated < RATED_FOR_PERCENT) {
    return {
      text: `early · ${rate.rated}`,
      tone: 'neutral',
      title: `Only ${rate.rated} rated use${rate.rated === 1 ? '' : 's'} — too few for a win rate`,
    }
  }
  const pct = Math.round((rate.won / rate.rated) * 100)
  return {
    text: `${pct}% · ${rate.rated} rated`,
    tone: pct >= 60 ? 'success' : pct >= 35 ? 'neutral' : 'warn',
    title: `${rate.won} of ${rate.rated} rated uses worked, across ${rate.uses} total uses`,
  }
}

export function WinRateChip({ rate }: { rate: WinRate | undefined }) {
  const label = winRateLabel(rate)
  return (
    <Chip tone={label.tone} title={label.title}>
      {label.text}
    </Chip>
  )
}

/** One dot per dialect the version carries. A dialect the tenant offers but the
 *  script has not been written in yet shows hollow — that is the "needs
 *  translation" signal, visible without opening the editor. */
export function DialectDots({ present, offered }: { present: string[]; offered: string[] }) {
  const all = [...new Set([...offered, ...present])]
  return (
    <span className="flex items-center gap-1" aria-label={`Dialects: ${present.map(langLabel).join(', ') || 'English only'}`}>
      {all.map((lang) => {
        const has = present.includes(lang)
        return (
          <span
            key={lang}
            title={`${langLabel(lang)}${has ? '' : ' — not written yet'}`}
            className={[
              'h-1.5 w-1.5 rounded-pill border',
              has ? 'border-accent bg-accent' : 'border-border-strong bg-transparent',
            ].join(' ')}
          />
        )
      })}
    </span>
  )
}

const TOKEN_SPLIT = /(\{\{\s*[A-Za-z0-9_.-]+\s*\}\})/g
// Deliberately NOT the /g one: `.test()` on a global regex advances lastIndex,
// so reusing TOKEN_SPLIT here would return true/false alternately.
const IS_TOKEN = /^\{\{\s*[A-Za-z0-9_.-]+\s*\}\}$/

/** Render text with any UNRESOLVED merge token underlined. After renderMerged
 *  every token that is still standing is one nothing supplied a value for —
 *  the manager has to see it before a rep reads it out on a call. */
function TokenText({ text }: { text: string }) {
  if (!text) return null
  return (
    <>
      {text.split(TOKEN_SPLIT).map((part, index) =>
        IS_TOKEN.test(part) ? (
          <span
            key={index}
            className="underline decoration-warn decoration-wavy underline-offset-2 text-warn"
            title="No value for this yet — set it in Courses or Settings"
          >
            {part}
          </span>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  )
}

/** The rep-facing rendering of a script body: highlight in bold, unresolved
 *  tokens underlined. Used by the editor preview, the read view and the
 *  teardown so all three agree on what the rep will actually see. */
export function ScriptText({
  paragraphs,
  className = '',
}: {
  paragraphs: ScriptParagraph[]
  className?: string
}) {
  if (!paragraphs.length) {
    return <p className="text-sm leading-7 text-fg-subtle italic">Nothing written yet.</p>
  }
  return (
    <div className={['space-y-3', className].join(' ')}>
      {paragraphs.map((paragraph, index) => (
        <p key={index} className="text-sm leading-7 text-fg-muted">
          <TokenText text={paragraph.before} />
          {paragraph.highlight && (
            <strong className="font-semibold text-fg">
              <TokenText text={paragraph.highlight} />
            </strong>
          )}
          <TokenText text={paragraph.after ?? ''} />
        </p>
      ))}
    </div>
  )
}

/** pm_promote_script_version raises 40001 with "script … moved on: expected
 *  standard …, found …" when the standard changed under the manager. That is
 *  never a retry — someone else promoted something, and this manager has to
 *  look at it first. */
export function isConcurrencyError(message: string | null | undefined): boolean {
  return !!message && /moved on/i.test(message)
}

export const MOVED_ON_NOTICE = 'Someone else promoted a version while this was open. Reload to see it before promoting.'

const DIALECT_KEY = 'sales-app.playbook.dialect'

/** The rep's dialect choice, remembered across sessions. localStorage rather
 *  than a profile column: it is a reading preference on one device, and a rep
 *  switching phones would rather re-pick than wait on a write. */
export function useDialectPreference(fallback: string): [string, (lang: string) => void] {
  const [lang, setLang] = useState<string>(() => {
    try {
      return localStorage.getItem(DIALECT_KEY) || fallback
    } catch {
      return fallback
    }
  })

  // The tenant default arrives after the config read; adopt it only while the
  // rep has made no choice of their own.
  useEffect(() => {
    try {
      if (!localStorage.getItem(DIALECT_KEY)) setLang(fallback)
    } catch {
      setLang(fallback)
    }
  }, [fallback])

  const choose = useCallback((next: string) => {
    setLang(next)
    try {
      localStorage.setItem(DIALECT_KEY, next)
    } catch {
      // Private mode / storage full — the choice still applies for this session.
    }
  }, [])

  return [lang, choose]
}

/** Insert text at the caret of a textarea and leave the cursor after it, so a
 *  manager can tap three tokens in a row without reaching for the mouse. */
export function insertAtCaret(el: HTMLTextAreaElement | null, text: string, onChange: (value: string) => void) {
  if (!el) return
  const start = el.selectionStart ?? el.value.length
  const end = el.selectionEnd ?? start
  const next = `${el.value.slice(0, start)}${text}${el.value.slice(end)}`
  onChange(next)
  // After React re-renders with the new value.
  requestAnimationFrame(() => {
    el.focus()
    const caret = start + text.length
    el.setSelectionRange(caret, caret)
  })
}

/** The tokens a manager can drop into a body, with what each one becomes. */
export const MERGE_TOKENS: { token: string; hint: string }[] = [
  { token: '{{name}}', hint: 'Customer first name' },
  { token: '{{rep}}', hint: 'The rep on the call' },
  { token: '{{client.name}}', hint: 'Your institute name' },
  { token: '{{course.name}}', hint: 'Course name' },
  { token: '{{course.fee}}', hint: 'Full fee' },
  { token: '{{course.emi}}', hint: 'Monthly EMI' },
  { token: '{{course.emi_months}}', hint: 'Number of EMIs' },
  { token: '{{course.usp}}', hint: 'What makes it different' },
  { token: '{{course.proof}}', hint: 'Result proof' },
  { token: '{{pay.amount}}', hint: 'Token amount' },
  { token: '{{pay.url}}', hint: 'Payment link' },
  { token: '{{pay.upi}}', hint: 'UPI ID' },
  { token: '{{callback.when}}', hint: 'Agreed callback time' },
]
