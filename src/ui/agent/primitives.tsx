import type { ReactNode } from 'react'
import { useState } from 'react'
import { Check, Loader2, Quote, User } from 'lucide-react'

// UI-BUILD-02 shared AI-surface primitives (Amendment E: A-UI/B-UI consume
// THIS kit — no second design vocabulary). Token-based only.

/** Dot-status badge — one shape for doc status, fact state, tiers, health. */
export function StatusBadge({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'accent' | 'success' | 'warn' | 'danger'
  children: ReactNode
}) {
  const dot: Record<string, string> = {
    neutral: 'bg-fg-subtle',
    accent: 'bg-accent',
    success: 'bg-success',
    warn: 'bg-warn',
    danger: 'bg-danger',
  }
  const text: Record<string, string> = {
    neutral: 'text-fg-muted',
    accent: 'text-accent',
    success: 'text-success',
    warn: 'text-warn',
    danger: 'text-danger',
  }
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-pill bg-surface-sunk px-2 py-0.5 text-2xs font-semibold',
        text[tone],
      ].join(' ')}
    >
      <span aria-hidden className={['h-1.5 w-1.5 rounded-pill', dot[tone]].join(' ')} />
      {children}
    </span>
  )
}

/** Original-message evidence: collapsed quote, expands inline. The source is
 *  the customer's own words — always available, never a mystery score. */
export function EvidenceLink({
  quote,
  meta,
}: {
  quote: string
  meta?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="min-w-0">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1 text-2xs text-fg-subtle underline decoration-border-strong underline-offset-2 hover:text-fg-muted"
      >
        <Quote aria-hidden size={11} strokeWidth={2} />
        {open ? 'Hide evidence' : 'View evidence'}
      </button>
      {open && (
        <blockquote className="mt-1.5 rounded-sm border-l-2 border-border-strong bg-surface-sunk px-2.5 py-1.5 text-xs text-fg">
          “{quote}”
          {meta && <footer className="mt-0.5 text-2xs text-fg-subtle">{meta}</footer>}
        </blockquote>
      )}
    </div>
  )
}

/** Tool-progress row — the agent narrating its work, quietly. */
export function ToolProgress({
  tool,
  status,
  summary,
}: {
  tool: string
  status: 'running' | 'done'
  summary: string
}) {
  return (
    <div className="flex items-start gap-2 py-1 text-xs">
      {status === 'running' ? (
        <Loader2 aria-hidden size={13} className="mt-0.5 shrink-0 animate-spin text-fg-subtle" />
      ) : (
        <Check aria-hidden size={13} className="mt-0.5 shrink-0 text-success" />
      )}
      <span className="mt-0.5 shrink-0 text-2xs font-semibold text-fg-subtle">{tool.replaceAll('_', ' ')}</span>
      <span className="min-w-0 text-fg-muted">{summary}</span>
    </div>
  )
}

/** Customer anchor — which human this whole exchange is about. */
export function AnchorChip({ name, detail }: { name: string; detail?: string }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-pill border border-border bg-surface px-2.5 py-1 text-xs">
      <User aria-hidden size={12} className="shrink-0 text-fg-subtle" />
      <span className="truncate font-medium text-fg">{name}</span>
      {detail && <span className="truncate text-fg-subtle">· {detail}</span>}
    </span>
  )
}
