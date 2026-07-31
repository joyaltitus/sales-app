import { useState } from 'react'
import { ChevronRight, Lock, RefreshCcw } from 'lucide-react'
import { Button } from '../../ui/Button'
import { DocumentCard } from '../../ui/agent/DocumentCard'
import { SampleTag, StatusBadge } from '../../ui/agent/primitives'
import {
  DOC_TEMPLATES,
  MOCK_DOCS,
  MOCK_MATCHES,
  MOCK_REVIVE,
} from '../../lib/mock-wave3'

// Documents studio (D-FLOW/T shape, UI only — no PDF engine, no wiring).
// One calm flow: template → customer → items (with "why this matches") →
// personalisation (locked company sections stay visibly locked) → preview →
// draft/final/sent. History and revenue-recovery suggestions live beside it.

const STEPS = ['Template', 'Customer', 'Items', 'Personalise', 'Preview'] as const

export function DocsStudio() {
  const [step, setStep] = useState(0)
  const [template, setTemplate] = useState(DOC_TEMPLATES[0])
  const [picked, setPicked] = useState<string[]>(['m1'])
  const [finalised, setFinalised] = useState(false)

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 lg:p-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-md font-semibold text-fg">Documents</h1>
          <p className="text-xs text-fg-muted">Quotations, proposals and summaries — from templates, never freehand.</p>
        </div>
        <SampleTag label="Preview — not wired" />
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* ------------------------------------------------ builder */}
        <section className="rounded-md border border-border bg-surface shadow-elev-1">
          {/* stepper */}
          <ol className="flex flex-wrap items-center gap-1 border-b border-border px-4 py-2.5">
            {STEPS.map((s, i) => (
              <li key={s} className="flex items-center gap-1">
                {i > 0 && <ChevronRight aria-hidden size={12} className="text-fg-subtle" />}
                <button
                  onClick={() => setStep(i)}
                  aria-current={step === i ? 'step' : undefined}
                  className={[
                    'rounded-sm px-2 py-1 text-2xs font-semibold uppercase',
                    step === i ? 'bg-accent-subtle text-accent' : 'text-fg-subtle hover:text-fg-muted',
                  ].join(' ')}
                  style={{ letterSpacing: 'var(--tracking-caps)' }}
                >
                  {s}
                </button>
              </li>
            ))}
          </ol>

          <div className="space-y-4 p-4">
            {step === 0 && (
              <div className="grid gap-2 sm:grid-cols-2">
                {DOC_TEMPLATES.map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      setTemplate(t)
                      setStep(1)
                    }}
                    aria-pressed={template === t}
                    className={[
                      'rounded-md border p-3 text-left text-sm transition-colors',
                      template === t
                        ? 'border-accent bg-accent-subtle text-fg'
                        : 'border-border bg-surface text-fg hover:border-border-strong',
                    ].join(' ')}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}

            {step === 1 && (
              <div className="space-y-2">
                <p className="label-caps">Customer & deal</p>
                <div className="rounded-md border border-accent bg-accent-subtle p-3 text-sm text-fg">
                  Anjali Ramesh — NEET repeater · Qualified · ₹60,000 budget
                </div>
                <Button size="sm" variant="secondary" onClick={() => setStep(2)}>
                  Continue
                </Button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-2.5">
                <p className="label-caps">Matched to her requirements</p>
                {MOCK_MATCHES.map((m) => {
                  const on = picked.includes(m.id)
                  return (
                    <div key={m.id} className={['rounded-md border p-3', on ? 'border-accent' : 'border-border'].join(' ')}>
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-semibold text-fg">{m.name}</h4>
                        <span className="tnum text-sm text-fg">{m.price}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-fg-muted">{m.detail}</p>
                      <ul className="mt-1.5 flex flex-wrap gap-1.5">
                        {m.fit.map((f) => (
                          <li key={f} className="rounded-pill bg-surface-sunk px-2 py-0.5 text-2xs text-fg-muted">
                            {f}
                          </li>
                        ))}
                      </ul>
                      <Button
                        size="sm"
                        variant={on ? 'secondary' : 'ghost'}
                        className="mt-2"
                        onClick={() =>
                          setPicked((p) => (on ? p.filter((x) => x !== m.id) : [...p, m.id]))
                        }
                      >
                        {on ? 'In document ✓' : 'Add to document'}
                      </Button>
                    </div>
                  )
                })}
                <Button size="sm" variant="secondary" onClick={() => setStep(3)}>
                  Continue with {picked.length} item{picked.length === 1 ? '' : 's'}
                </Button>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-3">
                <div>
                  <label htmlFor="doc-note" className="label-caps mb-1 block">
                    Personal note (editable)
                  </label>
                  <textarea
                    id="doc-note"
                    rows={2}
                    defaultValue="Anjali, as discussed — the evening batch with the two-instalment plan."
                    className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg"
                  />
                </div>
                <div className="rounded-md border border-border bg-surface-sunk p-3">
                  <p className="label-caps flex items-center gap-1.5">
                    <Lock aria-hidden size={11} /> Company terms (locked)
                  </p>
                  <p className="mt-1 text-xs text-fg-muted">
                    Refund policy, GST details and signatures come from the company template and
                    cannot be edited per-document.
                  </p>
                </div>
                <div className="tnum flex items-center justify-between rounded-md border border-border p-3 text-sm">
                  <span className="text-fg-muted">Total (2 instalments)</span>
                  <span className="font-semibold text-fg">₹60,000 — 2 × ₹30,000</span>
                </div>
                <Button size="sm" variant="secondary" onClick={() => setStep(4)}>
                  Preview
                </Button>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-3">
                {/* Mock PDF page */}
                <div className="mx-auto aspect-[1/1.414] w-full max-w-xs rounded-sm border border-border-strong bg-white p-4 text-[9px] leading-relaxed text-neutral-800 shadow-elev-2">
                  <div className="mb-2 flex items-center justify-between border-b border-neutral-200 pb-2">
                    <span className="font-semibold">Vidya Sagar Academy</span>
                    <span>Quotation · v2</span>
                  </div>
                  <p className="font-semibold">NEET Repeater — Evening batch</p>
                  <p className="mt-1">Student: Anjali Ramesh</p>
                  <p className="mt-2">Fee: ₹60,000 (two instalments of ₹30,000)</p>
                  <p>First instalment covers admission and materials.</p>
                  <p className="mt-3 text-neutral-400">Refund policy · GST 32ABCDE1234F · signature</p>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <StatusBadge tone={finalised ? 'accent' : 'neutral'}>
                    {finalised ? 'Final · v3' : 'Draft · v2'}
                  </StatusBadge>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {!finalised ? (
                    <Button size="sm" onClick={() => setFinalised(true)}>
                      Generate final
                    </Button>
                  ) : (
                    <Button size="sm">Send in conversation</Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setStep(3)}>
                    Back to editing
                  </Button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ------------------------------------- history + recovery */}
        <aside className="space-y-5">
          <section>
            <h3 className="label-caps mb-2">Recent documents</h3>
            <div className="space-y-2">
              {MOCK_DOCS.map((d) => (
                <DocumentCard key={d.id} doc={d} />
              ))}
            </div>
          </section>

          <section className="rounded-md border border-border bg-surface p-3.5 shadow-elev-1">
            <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-fg">
              <RefreshCcw aria-hidden size={14} className="text-accent" />
              Worth reviving
            </h3>
            <p className="mb-2 text-2xs text-fg-muted">
              Older leads that match what's newly available.
            </p>
            <div className="space-y-2.5">
              {MOCK_REVIVE.map((r) => (
                <div key={r.id} className="border-b border-border pb-2.5 last:border-0 last:pb-0">
                  <p className="text-xs font-medium text-fg">{r.customer}</p>
                  <p className="mt-0.5 text-2xs text-fg-muted">{r.reason}</p>
                  <p className="mt-0.5 text-2xs text-fg-subtle">Last touch {r.last}</p>
                  <Button size="sm" variant="ghost" className="mt-1 h-7 px-2 text-2xs">
                    Draft re-engagement message
                  </Button>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
