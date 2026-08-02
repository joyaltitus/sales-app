import { lazy, Suspense, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState } from '../../ui/EmptyState'
import { Button } from '../../ui/Button'
import { InboxScreen } from '../inbox/InboxScreen'
import { Award, BookOpenText, Bot, ChevronRight, FileText, ReceiptText, Sparkles } from 'lucide-react'
import { Skeleton } from '../../ui/Skeleton'

const SettingsPanel = lazy(() => import('./SettingsPanel'))
const MySeason = lazy(() => import('../momentum/MySeason'))

// Rep view stubs (SA-00 scaffold). Real screens land in the ONB/FLW/inbox epics.
function Screen({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <section className="mx-auto max-w-xl p-4 pt-6">
      <p className="label-caps text-accent">Workspace</p>
      <h1 className="mt-1 mb-4 text-2xl font-semibold tracking-[-0.04em] text-fg">{title}</h1>
      {children}
    </section>
  )
}

// The rep's landing is real as of SA-03 — it was a "Nothing due yet"
// placeholder through SA-00..SA-02.
export { Today } from './Today'

// The rep is `agent`, which IS in hub-service's TENANT_ROLES — reps can send.
export function RepInbox() {
  return <InboxScreen canSend />
}

// SA-05: `Leads` is GONE — RepShell mounts the CRM (lazy) on /leads.

// "More" holds the labeled doors (Joyal's doors model). A door whose flag is
// off is not rendered — proven here by the flag-gated Product-AI door.
export function More({ productAi }: { productAi: boolean }) {
  const [view, setView] = useState<'workspace' | 'season'>('workspace')
  return (
    <Screen title="More">
      <div className="mb-4 flex rounded-xl border border-border bg-surface-sunk p-1" role="tablist" aria-label="More view"><button role="tab" aria-selected={view === 'workspace'} onClick={() => setView('workspace')} className={['flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold', view === 'workspace' ? 'bg-surface text-fg shadow-elev-1' : 'text-fg-muted'].join(' ')}><Sparkles aria-hidden size={14} />Workspace</button><button role="tab" aria-selected={view === 'season'} onClick={() => setView('season')} className={['flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold', view === 'season' ? 'bg-surface text-fg shadow-elev-1' : 'text-fg-muted'].join(' ')}><Award aria-hidden size={14} />My season</button></div>
      {view === 'season' ? <Suspense fallback={<div className="space-y-3"><Skeleton className="h-28" /><Skeleton className="h-56" /></div>}><MySeason /></Suspense> : <>
      <Link to="/agent" className="relative mb-4 block overflow-hidden rounded-xl border border-[color-mix(in_srgb,var(--accent)_25%,var(--border))] bg-[linear-gradient(145deg,var(--surface-raised),var(--accent-subtle))] p-5 shadow-elev-2">
        <span aria-hidden className="absolute -top-12 -right-12 h-32 w-32 rounded-full bg-signal opacity-20 blur-2xl" />
        <span className="relative flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-fg"><Sparkles aria-hidden size={19} /></span>
        <h2 className="relative mt-4 text-lg font-semibold tracking-[-0.025em] text-fg">Ask the sales agent</h2>
        <p className="relative mt-1 max-w-sm text-xs leading-relaxed text-fg-muted">Get a customer summary, prepare a follow-up, or draft the next best action.</p>
        <span className="relative mt-4 inline-flex items-center gap-1 text-xs font-semibold text-accent">Open agent <ChevronRight aria-hidden size={14} /></span>
      </Link>

      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-elev-1">
        {/* UI-BUILD-02 (Joyal ruling): reps get the Documents studio too. */}
        <Door label="Documents" detail="Quotes and proposals" to="/docs" icon={FileText} />
        <Door label="Objections" detail="Approved talk tracks" to="/docs?workspace=playbook" icon={BookOpenText} />
        <Door label="Fees" detail="Current plans and discounts" to="/docs" icon={ReceiptText} />
        {productAi ? (
          <Door label="Product AI" detail="Ask the knowledge base" to="/more/product-ai" icon={Bot} />
        ) : (
          <div className="px-4 py-3 text-xs text-fg-subtle">
            Product AI — off for this workspace
          </div>
        )}
      </div>
      <Suspense fallback={<Skeleton className="mt-5 h-64" />}><SettingsPanel /></Suspense>
      </>}
    </Screen>
  )
}

function Door({ label, detail, to, icon: Icon }: { label: string; detail: string; to: string; icon: typeof FileText }) {
  return (
    <Link
      to={to}
      className="flex min-h-16 items-center gap-3 border-b border-border px-4 py-3 text-sm text-fg last:border-0 hover:bg-surface-sunk"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-md bg-surface-sunk text-fg-muted"><Icon aria-hidden size={17} /></span>
      <span className="min-w-0 flex-1"><span className="block font-semibold text-fg">{label}</span><span className="mt-0.5 block text-xs text-fg-muted">{detail}</span></span>
      <ChevronRight aria-hidden size={16} className="text-fg-subtle" />
    </Link>
  )
}

export function ProductAiDoor() {
  return (
    <Screen title="Product AI">
      <EmptyState
        title="Ask about a product"
        body="Answers come from your product knowledge base."
        action={<Button variant="secondary" size="sm">Coming soon</Button>}
      />
    </Screen>
  )
}
