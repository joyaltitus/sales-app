import { useMemo, useState } from 'react'
import { Check } from 'lucide-react'
import { SALES_CONFIG_DEFAULTS, setSalesConfig } from '../../../lib/sales-settings-data'
import type { Course, SalesConfig } from '../../../lib/sales-settings-data'
import { buildMergeVars, renderMerged, resolveParagraphs } from '../../../lib/script-body'
import type { LibraryScript } from '../../../lib/scripts-data'
import { ScriptText, langLabel } from './shared'

// Tenant sales settings. Every field here shows up inside a script the moment a
// rep sends it, so the panel previews the actual seat-reservation text rather
// than describing what the fields do.

const OFFERABLE = ['en', 'mn', 'hi', 'ta', 'te', 'kn', 'ml']

/** The composed text that spends this config. Keyed off the taxonomy key seeded
 *  by 068 rather than a label, which a manager may rename. */
const TOKEN_REQUEST_KEY = 'token_request'

function isHttps(url: string): boolean {
  if (!url) return true
  try {
    return new URL(url).protocol === 'https:'
  } catch {
    return false
  }
}

export function SettingsView({
  clientId,
  config,
  setConfig,
  reload,
  scripts,
  course,
  clientName,
}: {
  clientId: string | null
  config: SalesConfig
  setConfig: (config: SalesConfig) => void
  reload: () => void
  scripts: LibraryScript[]
  course: Course | null
  clientName: string | null
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const tokenScript = scripts.find((s) => s.taxonomyKey === TOKEN_REQUEST_KEY)
  const previewParagraphs = useMemo(() => {
    const { paragraphs } = resolveParagraphs(tokenScript?.current?.body, config.defaultLang)
    return renderMerged(
      paragraphs,
      buildMergeVars({
        contactName: 'Anjali',
        repName: 'you',
        clientName,
        course: course ? { name: course.name, facts: course.facts } : null,
        salesConfig: { tokenAmount: config.tokenAmount, payUrl: config.payUrl, upiVpa: config.upiVpa },
      }),
    )
  }, [tokenScript, config, course, clientName])

  /** Optimistic: the panel applies the change immediately and rolls the whole
   *  config back if the RPC's manager wall refuses it. */
  const save = async (patch: Partial<SalesConfig>) => {
    if (!clientId) return
    const previous = config
    const next = { ...config, ...patch }
    setConfig(next)
    setSaving(true)
    setError(null)
    setSaved(false)
    const result = await setSalesConfig(clientId, patch)
    setSaving(false)
    if (!result.ok) {
      setConfig(previous)
      setError(result.message)
      return
    }
    setSaved(true)
    reload()
  }

  const toggleLanguage = (code: string) => {
    if (code === 'en') return // always on: every base body is written in it
    const languages = config.languages.includes(code)
      ? config.languages.filter((l) => l !== code)
      : [...config.languages, code]
    // Never strand the default on a language that is no longer offered.
    const defaultLang = languages.includes(config.defaultLang) ? config.defaultLang : 'en'
    void save({ languages, defaultLang })
  }

  const field = 'mt-2 h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-fg placeholder:text-fg-subtle'
  const payUrlValid = isHttps(config.payUrl)

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-surface shadow-elev-1">
        <div className="border-b border-border p-4">
          <p className="label-caps text-accent">Sales settings</p>
          <h3 className="mt-1 text-md font-semibold text-fg">What the money words say.</h3>
          <p className="mt-1 text-xs text-fg-muted">Managers only. Every value here lands inside a rep's message.</p>
        </div>

        {error && (
          <p role="alert" className="border-b border-border bg-danger-subtle px-4 py-2 text-xs text-danger">
            {error}
          </p>
        )}

        <div className="space-y-5 p-4">
          <div>
            <p className="text-xs font-semibold text-fg">Dialects your team sells in</p>
            <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Dialects offered">
              {OFFERABLE.map((code) => {
                const on = config.languages.includes(code)
                return (
                  <button
                    key={code}
                    onClick={() => toggleLanguage(code)}
                    aria-pressed={on}
                    disabled={code === 'en' || saving}
                    title={code === 'en' ? 'English is always on — every script is written in it first' : undefined}
                    className={[
                      'min-h-8 rounded-pill border px-3 text-xs font-semibold disabled:opacity-60',
                      on ? 'border-accent bg-accent-subtle text-accent' : 'border-border text-fg-muted hover:text-fg',
                    ].join(' ')}
                  >
                    {langLabel(code)}
                  </button>
                )
              })}
            </div>
          </div>

          <label className="block text-xs font-semibold text-fg">
            Default dialect
            <select
              value={config.defaultLang}
              onChange={(event) => void save({ defaultLang: event.target.value })}
              disabled={saving}
              className={field}
            >
              {config.languages.map((code) => (
                <option key={code} value={code}>
                  {langLabel(code)}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-fg">
              UPI ID
              <input
                defaultValue={config.upiVpa}
                onBlur={(event) => event.target.value !== config.upiVpa && void save({ upiVpa: event.target.value })}
                placeholder="academy@ybl"
                className={field}
              />
            </label>
            <label className="block text-xs font-semibold text-fg">
              Payee name
              <input
                defaultValue={config.upiPayee}
                onBlur={(event) => event.target.value !== config.upiPayee && void save({ upiPayee: event.target.value })}
                placeholder="Vidya Sagar Academy"
                className={field}
              />
            </label>
          </div>

          <label className="block text-xs font-semibold text-fg">
            Payment link
            <input
              type="url"
              defaultValue={config.payUrl}
              onBlur={(event) => {
                const value = event.target.value.trim()
                if (value === config.payUrl) return
                if (!isHttps(value)) {
                  setError('The payment link must start with https:// — a rep is sending this to a customer.')
                  event.target.value = config.payUrl
                  return
                }
                setError(null)
                void save({ payUrl: value })
              }}
              placeholder="https://…"
              aria-invalid={!payUrlValid}
              className={field}
            />
            <span className="mt-1 block text-2xs font-normal text-fg-muted">https only.</span>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-fg">
              Token amount (₹)
              <input
                type="number"
                min={1}
                step={1}
                defaultValue={config.tokenAmount}
                onBlur={(event) => {
                  const value = Math.round(Number(event.target.value))
                  if (!Number.isFinite(value) || value <= 0) {
                    event.target.value = String(config.tokenAmount)
                    return
                  }
                  if (value !== config.tokenAmount) void save({ tokenAmount: value })
                }}
                className={`tnum ${field}`}
              />
            </label>
            <label className="block text-xs font-semibold text-fg">
              Token note
              <input
                defaultValue={config.tokenNote}
                onBlur={(event) => event.target.value !== config.tokenNote && void save({ tokenNote: event.target.value })}
                placeholder="Seat reservation"
                className={field}
              />
            </label>
          </div>

          <p className="flex min-h-5 items-center gap-1.5 text-2xs text-fg-muted" role="status">
            {saving ? (
              'Saving…'
            ) : saved ? (
              <>
                <Check aria-hidden size={12} className="text-success" /> Saved
              </>
            ) : (
              'Changes save when you leave a field.'
            )}
          </p>
        </div>
      </section>

      <aside className="min-w-0 rounded-xl border border-border bg-surface p-4 shadow-elev-1">
        <p className="label-caps">What the rep sends</p>
        <h3 className="mt-1 text-sm font-semibold text-fg">Seat reservation, in {langLabel(config.defaultLang)}</h3>
        <div className="mt-3 rounded-lg border border-border bg-surface-sunk p-4">
          {tokenScript?.current ? (
            <ScriptText paragraphs={previewParagraphs} />
          ) : (
            <p className="text-xs leading-relaxed text-fg-muted">
              No “Seat reservation text” script yet. Add one in the Library and this preview fills in.
            </p>
          )}
        </div>
        <p className="mt-2 text-2xs text-fg-subtle">
          {course ? `Using ${course.name}.` : 'No course facts yet — add one in Courses.'}
          {config.tokenAmount === SALES_CONFIG_DEFAULTS.tokenAmount && ' Token amount is still the default.'}
        </p>
      </aside>
    </div>
  )
}
