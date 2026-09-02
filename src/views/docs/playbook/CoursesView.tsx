import { useMemo, useState } from 'react'
import { GraduationCap, TriangleAlert } from 'lucide-react'
import { Button } from '../../../ui/Button'
import { Chip } from '../../../ui/Chip'
import { EmptyState } from '../../../ui/EmptyState'
import { COURSE_FACT_KEYS, setItemSalesFacts } from '../../../lib/sales-settings-data'
import type { Course } from '../../../lib/sales-settings-data'
import { buildMergeVars, findTokens } from '../../../lib/script-body'
import type { LibraryScript } from '../../../lib/scripts-data'

// Course facts are what {{course.*}} resolves to. The tab's real job is the
// bottom half of each card: the tokens the standards actually ask for that this
// course cannot answer yet — the gap between what is written and what is known.

const FACT_LABELS: Record<string, { label: string; hint: string; numeric?: boolean }> = {
  fee: { label: 'Full fee (₹)', hint: '{{course.fee}}', numeric: true },
  emi_monthly: { label: 'Monthly EMI (₹)', hint: '{{course.emi}}', numeric: true },
  emi_months: { label: 'Number of EMIs', hint: '{{course.emi_months}}', numeric: true },
  duration: { label: 'Duration', hint: 'e.g. 11 months' },
  batch_start: { label: 'Batch starts', hint: 'YYYY-MM-DD' },
  usp: { label: 'What makes it different', hint: '{{course.usp}}' },
  proof: { label: 'Result proof', hint: '{{course.proof}}' },
  token_amount: { label: 'Token amount (₹)', hint: '{{pay.amount}} fallback', numeric: true },
}

function CourseCard({
  course,
  askedFor,
  onSaved,
}: {
  course: Course
  askedFor: string[]
  onSaved: () => void
}) {
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(COURSE_FACT_KEYS.map((key) => [key, course.facts[key] === undefined ? '' : String(course.facts[key])])),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // Which {{course.*}} / {{pay.amount}} tokens the standards ask for that this
  // course still cannot answer.
  const missing = useMemo(() => {
    const vars = buildMergeVars({ course: { name: course.name, facts: course.facts } })
    return askedFor.filter((token) => (token.startsWith('course.') || token === 'pay.amount') && !(token in vars))
  }, [askedFor, course])

  const save = async () => {
    setSaving(true)
    setError(null)
    setSaved(false)
    // pm_set_item_sales_facts REPLACES the object, so send everything —
    // including keys this form does not know about, which are preserved from
    // the row we read.
    const facts: Record<string, unknown> = { ...course.facts }
    for (const key of COURSE_FACT_KEYS) {
      const raw = draft[key]?.trim() ?? ''
      if (!raw) {
        delete facts[key]
        continue
      }
      facts[key] = FACT_LABELS[key]?.numeric ? Number(raw) : raw
    }
    const result = await setItemSalesFacts(course.id, facts)
    setSaving(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setSaved(true)
    onSaved()
  }

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-elev-1">
      <header className="flex flex-wrap items-center gap-3 border-b border-border p-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-subtle text-accent">
          <GraduationCap aria-hidden size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-fg">{course.name}</h3>
          <p className="mt-0.5 text-2xs text-fg-muted">{course.slug}</p>
        </div>
        {missing.length > 0 && (
          <Chip tone="warn">
            <TriangleAlert aria-hidden size={11} /> {missing.length} unanswered
          </Chip>
        )}
      </header>

      {error && (
        <p role="alert" className="border-b border-border bg-danger-subtle px-4 py-2 text-xs text-danger">
          {error}
        </p>
      )}

      <div className="grid gap-3 p-4 sm:grid-cols-2">
        {COURSE_FACT_KEYS.map((key) => {
          const meta = FACT_LABELS[key]
          return (
            <label key={key} className="block text-xs font-semibold text-fg">
              {meta.label}
              <input
                type={meta.numeric ? 'number' : 'text'}
                value={draft[key] ?? ''}
                onChange={(event) => setDraft((all) => ({ ...all, [key]: event.target.value }))}
                placeholder={meta.hint}
                aria-label={`${meta.label} for ${course.name}`}
                className={[
                  'mt-1.5 h-9 w-full rounded-md border border-border bg-surface-sunk px-3 text-sm text-fg placeholder:text-fg-subtle',
                  meta.numeric ? 'tnum' : '',
                ].join(' ')}
              />
            </label>
          )
        })}
      </div>

      {missing.length > 0 && (
        <div className="border-t border-border bg-warn-subtle px-4 py-3">
          <p className="text-2xs font-semibold text-fg">Your scripts ask for these and this course has no answer:</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {missing.map((token) => (
              <span key={token} className="rounded-md border border-border bg-surface px-2 py-0.5 text-2xs text-fg-muted">
                {`{{${token}}}`}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 border-t border-border bg-surface-sunk px-4 py-3">
        <Button size="sm" onClick={() => void save()} disabled={saving}>
          {saving ? 'Saving…' : 'Save facts'}
        </Button>
        {saved && (
          <span className="text-2xs text-success" role="status">
            Saved
          </span>
        )}
      </div>
    </section>
  )
}

export function CoursesView({
  courses,
  scripts,
  onSaved,
}: {
  courses: Course[]
  scripts: LibraryScript[]
  onSaved: () => void
}) {
  // Every token any STANDARD asks for. Drafts are excluded deliberately: a
  // half-written draft would flood every course with warnings.
  const askedFor = useMemo(() => {
    const all = new Set<string>()
    for (const script of scripts) {
      if (script.current?.status !== 'standard') continue
      for (const token of findTokens(script.current.body)) all.add(token)
    }
    return [...all]
  }, [scripts])

  if (!courses.length) {
    return (
      <EmptyState
        icon={GraduationCap}
        title="No active courses yet."
        body="Courses come from your catalogue. Once one exists, its fee, EMI and proof fill in every {{course.…}} in the playbook."
      />
    )
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {courses.map((course) => (
        <CourseCard key={course.id} course={course} askedFor={askedFor} onSaved={onSaved} />
      ))}
    </div>
  )
}
