import { ArrowRight, Sparkles } from 'lucide-react'

export function NextAction({ label, detail, onClick, compact = false }: { label: string; detail?: string; onClick?: () => void; compact?: boolean }) {
  const content = <><span className={['flex shrink-0 items-center justify-center rounded-md bg-accent-subtle text-accent', compact ? 'h-6 w-6' : 'h-7 w-7'].join(' ')}><Sparkles aria-hidden size={compact ? 11 : 13} /></span><span className="min-w-0 flex-1"><span className="label-caps block">Recommended next</span><span className={['block truncate font-semibold text-fg', compact ? 'text-2xs' : 'mt-0.5 text-xs'].join(' ')}>{label}</span>{detail && <span className="mt-0.5 block truncate text-2xs text-fg-muted">{detail}</span>}</span><ArrowRight aria-hidden size={14} className="shrink-0 text-fg-subtle" /></>
  const cls = ['flex w-full items-center gap-2.5 rounded-lg border border-border bg-surface-sunk px-3 text-left', compact ? 'min-h-9 py-1.5' : 'min-h-11'].join(' ')
  return onClick ? <button onClick={onClick} className={`${cls} hover:border-border-strong hover:bg-surface-raised`}>{content}</button> : <div className={cls}>{content}</div>
}
