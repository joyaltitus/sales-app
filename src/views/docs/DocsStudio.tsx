import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Eye,
  FileCheck2,
  FileText,
  Lock,
  MessageCircle,
  Minus,
  Plus,
  SendHorizontal,
  Sparkles,
} from 'lucide-react'
import { Button } from '../../ui/Button'
import { Chip } from '../../ui/Chip'
import { DocumentCard } from '../../ui/agent/DocumentCard'
import { SampleTag } from '../../ui/agent/primitives'
import { DOC_TEMPLATES, MOCK_DOCS, MOCK_MATCHES } from '../../lib/mock-wave3'
import { useClient } from '../../shell/ClientProvider'
import { Playbook } from './Playbook'

function parsePrice(price: string) {
  return Number(price.replace(/[^0-9]/g, '')) || 0
}

export function DocsStudio() {
  const { activeClient } = useClient()
  const canManage = activeClient?.role === 'manager' || activeClient?.role === 'client_admin' || activeClient?.role === 'super_admin'
  const [searchParams, setSearchParams] = useSearchParams()
  const workspace: 'documents' | 'playbook' = searchParams.get('workspace') === 'playbook' ? 'playbook' : 'documents'
  const [template, setTemplate] = useState(DOC_TEMPLATES[0])
  const [picked, setPicked] = useState<string[]>(['m1'])
  const [discount, setDiscount] = useState(0)
  const [approval, setApproval] = useState<'draft' | 'pending' | 'approved'>('draft')
  const [templatesOpen, setTemplatesOpen] = useState(false)

  const setWorkspace = (next: 'documents' | 'playbook') => {
    const params = new URLSearchParams(searchParams)
    if (next === 'playbook') params.set('workspace', 'playbook')
    else params.delete('workspace')
    setSearchParams(params, { replace: true })
  }

  const subtotal = useMemo(
    () => MOCK_MATCHES.filter((item) => picked.includes(item.id)).reduce((sum, item) => sum + parsePrice(item.price), 0),
    [picked],
  )
  const total = Math.max(0, subtotal - discount)

  return (
    <div className="page-frame max-w-[1500px] space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-caps text-accent">{workspace === 'documents' ? 'Documents' : 'Company language'}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-fg">{workspace === 'documents' ? 'Quote without the busywork.' : 'Turn field learning into the standard.'}</h1>
          <p className="mt-1 text-sm text-fg-muted">{workspace === 'documents' ? 'Template, customer and approved terms are already in place.' : canManage ? 'Review, test and teach the counters your team can trust.' : 'The strongest company answer for every common objection.'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border border-border bg-surface-sunk p-0.5" role="tablist" aria-label="Docs workspace">
            {(['documents', 'playbook'] as const).map((item) => <button key={item} role="tab" aria-selected={workspace === item} onClick={() => setWorkspace(item)} className={['rounded-sm px-3 py-1.5 text-xs font-semibold capitalize', workspace === item ? 'bg-surface-raised text-fg shadow-elev-1' : 'text-fg-muted hover:text-fg'].join(' ')}>{item}</button>)}
          </div>
          <SampleTag label="Preview — not wired" />
          {workspace === 'documents' && <Chip tone={approval === 'approved' ? 'success' : approval === 'pending' ? 'warn' : 'neutral'}>
            {approval === 'approved' ? 'Approved' : approval === 'pending' ? 'Approval pending' : 'Draft'}
          </Chip>}
        </div>
      </header>

      {workspace === 'playbook' ? <Playbook canManage={canManage} /> : <>
      <div className="grid gap-5 xl:grid-cols-[230px_minmax(0,1fr)_360px]">
        <aside className="space-y-4">
          <section className="rounded-xl border border-border bg-surface p-3 shadow-elev-1">
            <p className="label-caps px-2 pt-1">Templates</p>
            <div className="mt-2 space-y-1">
              {DOC_TEMPLATES.map((item, index) => (
                <button
                  key={item}
                  onClick={() => setTemplate(item)}
                  className={[
                    'flex w-full items-center gap-2 rounded-md px-2.5 py-2.5 text-left text-xs font-medium transition-colors',
                    template === item ? 'bg-accent-subtle text-accent' : 'text-fg-muted hover:bg-surface-sunk hover:text-fg',
                  ].join(' ')}
                >
                  <FileText aria-hidden size={14} />
                  <span className="min-w-0 flex-1">{item}</span>
                  {index === 0 && <span className="h-1.5 w-1.5 rounded-pill bg-signal" />}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-surface p-4 shadow-elev-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-fg"><Lock aria-hidden size={14} className="text-success" /> Guardrails applied</div>
            <p className="mt-2 text-2xs leading-relaxed text-fg-muted">GST, refund terms and signatures come from the approved company template.</p>
          </section>
        </aside>

        <main className="overflow-hidden rounded-xl border border-border bg-surface shadow-elev-2">
          <div className="flex flex-wrap items-center gap-3 border-b border-border bg-surface-raised px-5 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-subtle text-accent"><FileCheck2 aria-hidden size={19} /></div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-fg">{template}</p>
              <p className="mt-0.5 text-2xs text-fg-muted">Quotation #Q-2026-184 · autosaved just now</p>
            </div>
            <button onClick={() => setTemplatesOpen((open) => !open)} className="inline-flex h-9 items-center gap-1 rounded-md border border-border px-3 text-xs font-semibold text-fg-muted hover:border-border-strong hover:text-fg xl:hidden">
              Change template <ChevronDown aria-hidden size={14} />
            </button>
          </div>

          {templatesOpen && (
            <div className="grid gap-2 border-b border-border bg-surface-sunk p-3 xl:hidden">
              {DOC_TEMPLATES.map((item) => <button key={item} onClick={() => { setTemplate(item); setTemplatesOpen(false) }} className="rounded-md bg-surface px-3 py-2 text-left text-xs text-fg">{item}</button>)}
            </div>
          )}

          <div className="space-y-6 p-5">
            <section>
              <div className="mb-2 flex items-center justify-between">
                <p className="label-caps">Customer</p>
                <span className="flex items-center gap-1 text-2xs text-success"><Check aria-hidden size={12} /> Pulled from CRM</span>
              </div>
              <button className="flex w-full items-center gap-3 rounded-lg border border-border bg-surface-sunk px-4 py-3 text-left hover:border-border-strong">
                <span className="flex h-9 w-9 items-center justify-center rounded-md bg-accent-subtle text-sm font-bold text-accent">A</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-fg">Anjali Ramesh</span>
                  <span className="mt-0.5 block text-xs text-fg-muted">NEET repeater · Qualified · ₹60,000 budget</span>
                </span>
                <ChevronDown aria-hidden size={16} className="text-fg-subtle" />
              </button>
            </section>

            <section>
              <div className="mb-2 flex items-end justify-between gap-3">
                <div>
                  <p className="label-caps">Line items</p>
                  <p className="mt-1 text-xs text-fg-muted">Recommendations are matched to the customer’s stated requirements.</p>
                </div>
                <span className="text-2xs font-semibold text-accent"><Sparkles aria-hidden size={12} className="mr-1 inline" />AI matched</span>
              </div>
              <div className="overflow-hidden rounded-lg border border-border">
                {MOCK_MATCHES.map((item) => {
                  const on = picked.includes(item.id)
                  return (
                    <div key={item.id} className="grid gap-3 border-b border-border p-4 last:border-0 sm:grid-cols-[auto_1fr_auto] sm:items-center">
                      <button
                        onClick={() => setPicked((current) => on ? current.filter((id) => id !== item.id) : [...current, item.id])}
                        className={['flex h-6 w-6 items-center justify-center rounded-sm border', on ? 'border-accent bg-accent text-accent-fg' : 'border-border-strong text-transparent hover:text-fg-subtle'].join(' ')}
                        aria-pressed={on}
                        aria-label={`${on ? 'Remove' : 'Add'} ${item.name}`}
                      ><Check aria-hidden size={14} /></button>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-fg">{item.name}</h3>
                        <p className="mt-0.5 text-xs text-fg-muted">{item.detail}</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {item.fit.slice(0, 2).map((fit) => <span key={fit} className="rounded-pill bg-success-subtle px-2 py-0.5 text-2xs font-medium text-success">{fit}</span>)}
                        </div>
                      </div>
                      <span className="tnum text-sm font-semibold text-fg">{item.price}</span>
                    </div>
                  )
                })}
                <button className="flex min-h-11 w-full items-center justify-center gap-1.5 bg-surface-sunk text-xs font-semibold text-fg-muted hover:text-fg"><Plus aria-hidden size={14} /> Add custom line item</button>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-[1fr_260px]">
              <div>
                <label htmlFor="quotation-note" className="label-caps mb-2 block">Personal note</label>
                <textarea id="quotation-note" rows={4} defaultValue="Anjali, as discussed — the evening batch with the two-instalment plan." className="w-full resize-none rounded-lg border border-border bg-surface-raised px-3 py-2.5 text-sm leading-relaxed text-fg shadow-[var(--inset-highlight)]" />
              </div>
              <div className="rounded-lg border border-border bg-surface-sunk p-4">
                <div className="flex items-center justify-between text-xs text-fg-muted"><span>Subtotal</span><span className="tnum">₹{subtotal.toLocaleString('en-IN')}</span></div>
                <div className="mt-3 flex items-center justify-between gap-3 text-xs text-fg-muted">
                  <label htmlFor="discount">Discount</label>
                  <div className="flex items-center rounded-md border border-border bg-surface">
                    <button onClick={() => setDiscount((value) => Math.max(0, value - 1000))} className="p-2 text-fg-muted hover:text-fg" aria-label="Decrease discount"><Minus aria-hidden size={12} /></button>
                    <input id="discount" value={discount} onChange={(event) => setDiscount(Number(event.target.value) || 0)} className="tnum w-20 border-x border-border bg-transparent px-2 py-1.5 text-right text-xs text-fg outline-none" />
                    <button onClick={() => setDiscount((value) => value + 1000)} className="p-2 text-fg-muted hover:text-fg" aria-label="Increase discount"><Plus aria-hidden size={12} /></button>
                  </div>
                </div>
                <div className="mt-4 flex items-end justify-between border-t border-border pt-4"><span className="text-xs font-semibold text-fg">Total</span><strong className="tnum text-xl tracking-[-0.03em] text-fg">₹{total.toLocaleString('en-IN')}</strong></div>
                <p className="mt-2 text-right text-2xs text-fg-muted">2 × ₹{Math.round(total / 2).toLocaleString('en-IN')}</p>
              </div>
            </section>
          </div>

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface-sunk px-5 py-4">
            <div className="flex items-center gap-2 text-2xs text-fg-muted"><Clock3 aria-hidden size={13} /> Last edit is kept as Draft v3.</div>
            {approval === 'draft' ? (
              <Button onClick={() => setApproval('pending')} disabled={!picked.length}><SendHorizontal aria-hidden size={15} /> Send for approval</Button>
            ) : approval === 'pending' ? (
              <div className="flex items-center gap-2"><Button variant="secondary" onClick={() => setApproval('approved')}>Preview manager approval</Button><Chip tone="warn">Waiting</Chip></div>
            ) : (
              <Button><MessageCircle aria-hidden size={15} /> Send in conversation</Button>
            )}
          </footer>
        </main>

        <aside className="space-y-4">
          <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-elev-2">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div><p className="label-caps">Live preview</p><p className="mt-1 text-xs font-semibold text-fg">Quotation · v3</p></div>
              <button className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-2xs font-semibold text-fg-muted hover:bg-surface-sunk"><Eye aria-hidden size={13} /> Full page</button>
            </div>
            <div className="bg-canvas p-5">
              <div className="mx-auto aspect-[1/1.414] w-full max-w-[290px] rounded-xs border border-border-strong bg-white p-5 text-[9px] leading-relaxed text-neutral-800 shadow-elev-2">
                <div className="flex items-center justify-between border-b border-neutral-200 pb-3"><strong>Vidya Sagar Academy</strong><span>Q-2026-184</span></div>
                <p className="mt-5 text-[12px] font-bold">Fee quotation</p>
                <p className="mt-1 text-neutral-500">Prepared for Anjali Ramesh</p>
                <div className="mt-5 border-y border-neutral-200 py-3">
                  {MOCK_MATCHES.filter((item) => picked.includes(item.id)).map((item) => <div key={item.id} className="flex justify-between gap-4"><span>{item.name}</span><strong>{item.price}</strong></div>)}
                </div>
                <div className="mt-4 flex justify-between text-[11px]"><strong>Total</strong><strong>₹{total.toLocaleString('en-IN')}</strong></div>
                <p className="mt-5">Two equal instalments are available. Terms and refund policy follow the academy agreement.</p>
                <p className="mt-10 text-neutral-400">GST 32ABCDE1234F · authorised signature</p>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-surface p-4 shadow-elev-1">
            <div className="flex items-center justify-between"><h2 className="text-sm font-semibold text-fg">Document status</h2><CircleDollarSign aria-hidden size={16} className="text-accent" /></div>
            <ol className="mt-4 space-y-4">
              {[
                ['Draft created', '11:42 am', true],
                ['Sent for approval', approval === 'draft' ? 'Waiting on you' : '11:47 am', approval !== 'draft'],
                ['Approved', approval === 'approved' ? '11:49 am' : 'Pending', approval === 'approved'],
                ['Viewed by customer', 'Not sent yet', false],
                ['Accepted', '—', false],
              ].map(([label, meta, done]) => (
                <li key={String(label)} className="flex gap-3">
                  <span className={['mt-0.5 flex h-5 w-5 items-center justify-center rounded-pill border', done ? 'border-success bg-success text-white' : 'border-border-strong text-transparent'].join(' ')}><Check aria-hidden size={11} /></span>
                  <span className="min-w-0 flex-1"><span className="block text-xs font-medium text-fg">{label}</span><span className="mt-0.5 block text-2xs text-fg-muted">{meta}</span></span>
                </li>
              ))}
            </ol>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between"><h2 className="label-caps">Recent documents</h2><span className="text-2xs text-fg-muted">3</span></div>
            <div className="space-y-2">{MOCK_DOCS.map((doc) => <DocumentCard key={doc.id} doc={doc} />)}</div>
          </section>
        </aside>
      </div>

      {approval === 'approved' && (
        <div className="fixed right-5 bottom-5 z-40 flex max-w-sm items-center gap-3 rounded-lg border border-[color-mix(in_srgb,var(--success)_25%,var(--border))] bg-surface-glass p-3 text-success shadow-elev-3 backdrop-blur-xl" role="status">
          <CheckCircle2 aria-hidden size={18} />
          <span className="text-xs font-semibold">Approved. It’s ready to send in the customer thread.</span>
        </div>
      )}
      </>}
    </div>
  )
}
