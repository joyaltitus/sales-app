import { useEffect, useRef, useState } from 'react'
import { CalendarCheck, Check, ChevronDown, CircleAlert, FileText, Mail, MessageCircle, NotebookPen, Pencil, RefreshCw, Send, Undo2, UserPlus } from 'lucide-react'
import type { CopilotToolActionPreview, CopilotToolKind, CopilotToolState } from './copilotMocks'

const META: Record<CopilotToolKind, { icon: typeof Mail; label: string; tone: string }> = {
  send_email: { icon: Mail, label: 'Email', tone: 'text-info bg-info-subtle' },
  send_whatsapp: { icon: MessageCircle, label: 'WhatsApp', tone: 'text-success bg-success-subtle' },
  schedule_follow_up: { icon: CalendarCheck, label: 'Follow-up', tone: 'text-warn bg-warn-subtle' },
  create_booking: { icon: CalendarCheck, label: 'Booking', tone: 'text-accent bg-accent-subtle' },
  draft_quotation: { icon: FileText, label: 'Quotation', tone: 'text-accent bg-accent-subtle' },
  update_stage: { icon: RefreshCw, label: 'Lead stage', tone: 'text-warn bg-warn-subtle' },
  add_note: { icon: NotebookPen, label: 'CRM fact', tone: 'text-info bg-info-subtle' },
  assign_todo: { icon: UserPlus, label: 'Todo', tone: 'text-accent bg-accent-subtle' },
}

export function CopilotToolCard({ action }: { action: CopilotToolActionPreview }) {
  const [state, setState] = useState<CopilotToolState>(action.state)
  const [expanded, setExpanded] = useState(!!action.preview)
  const [editing, setEditing] = useState(false)
  const [copy, setCopy] = useState(action.preview ?? action.summary)
  const timer = useRef<number | null>(null)
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current) }, [])
  const meta = META[action.kind]
  const Icon = meta.icon
  const execute = () => { setState('executing'); timer.current = window.setTimeout(() => setState('done'), 850) }

  if (state === 'executing') return <article className="relative overflow-hidden rounded-xl border border-accent/25 bg-surface p-4 shadow-elev-1"><span aria-hidden className="absolute inset-y-0 -left-1/2 w-1/2 animate-[shimmer_1.2s_infinite] bg-[linear-gradient(90deg,transparent,var(--accent-subtle),transparent)] motion-reduce:animate-none" /><div className="relative flex items-center gap-3"><span className={['flex h-9 w-9 items-center justify-center rounded-lg', meta.tone].join(' ')}><Icon aria-hidden size={16} /></span><div className="min-w-0 flex-1"><p className="label-caps text-accent">Executing · Preview</p><h3 className="mt-1 text-sm font-semibold text-fg">{action.title}</h3></div><span className="h-4 w-4 animate-spin rounded-pill border-2 border-accent border-t-transparent motion-reduce:animate-none" /></div></article>

  return <article className={['overflow-hidden rounded-xl border bg-surface shadow-elev-1', state === 'done' ? 'border-success/25' : state === 'failed' ? 'border-danger/25' : 'border-border'].join(' ')}><div className="flex items-start gap-3 p-4"><span className={['flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', state === 'done' ? 'bg-success-subtle text-success' : state === 'failed' ? 'bg-danger-subtle text-danger' : meta.tone].join(' ')}>{state === 'done' ? <Check aria-hidden size={17} /> : state === 'failed' ? <CircleAlert aria-hidden size={17} /> : <Icon aria-hidden size={16} />}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="label-caps">{state === 'done' ? 'Done' : state === 'failed' ? 'Failed' : `Proposed ${meta.label}`}</p>{action.reversible && <span className="text-2xs text-fg-subtle">Reversible</span>}</div><h3 className="mt-1 text-sm font-semibold text-fg">{action.title}</h3><p className="mt-1 text-xs leading-relaxed text-fg-muted">{action.summary}</p><p className="mt-2 text-2xs font-semibold text-accent">{action.target}</p></div>{action.preview && <button onClick={() => setExpanded((value) => !value)} aria-expanded={expanded} aria-label={`${expanded ? 'Hide' : 'Show'} action preview`} className="rounded-md p-1.5 text-fg-subtle hover:bg-surface-sunk hover:text-fg"><ChevronDown aria-hidden size={14} className={expanded ? 'rotate-180' : ''} /></button>}</div>{expanded && <div className="border-t border-border bg-surface-sunk p-3">{editing ? <textarea value={copy} onChange={(event) => setCopy(event.target.value)} rows={4} aria-label="Edit proposed content" className="w-full resize-y rounded-md border border-border bg-surface p-3 text-xs leading-relaxed text-fg" /> : <p className="whitespace-pre-wrap text-xs leading-relaxed text-fg-muted">{copy}</p>}</div>}<footer className="flex items-center gap-1 border-t border-border px-3 py-2">{state === 'proposed' && <><button onClick={execute} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-accent px-3 text-xs font-semibold text-accent-fg"><Send aria-hidden size={13} /> Approve</button><button onClick={() => { setExpanded(true); setEditing((value) => !value) }} className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-semibold text-fg-muted hover:bg-surface-sunk"><Pencil aria-hidden size={12} /> Edit</button><button onClick={() => setState('done')} className="ml-auto h-8 rounded-md px-2 text-xs font-semibold text-fg-subtle hover:text-danger">Dismiss</button></>}{state === 'done' && <><span className="flex items-center gap-1 text-2xs font-semibold text-success"><Check aria-hidden size={12} /> Completed just now</span>{action.reversible && <button onClick={() => setState('proposed')} className="ml-auto inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-semibold text-fg-muted hover:bg-surface-sunk"><Undo2 aria-hidden size={12} /> Undo · 8s</button>}</>}{state === 'failed' && <><span className="text-2xs text-danger">No permission for this assignee.</span><button onClick={execute} className="ml-auto inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-semibold text-fg-muted hover:bg-surface-sunk"><RefreshCw aria-hidden size={12} /> Retry</button></>}</footer></article>
}
