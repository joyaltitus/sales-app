import { useState } from 'react'
import { AtSign, ChevronDown, Download, Mail, MessageCircle, Paperclip, Phone, RotateCcw } from 'lucide-react'
import { CALL_LOGS } from '../calls/callMocks'
import { NextAction } from '../../ui/NextAction'

export type RelationshipEventPreview =
  | { id: string; kind: 'call'; at: string; actor: string; durationSeconds: number; outcome: 'progressing' | 'callback' | 'closed' | 'no_answer'; note?: string; objection?: string; sample: true }
  | { id: string; kind: 'message'; channel: 'whatsapp' | 'instagram'; direction: 'inbound' | 'outbound'; at: string; body: string; sample: true }
  | { id: string; kind: 'email'; direction: 'inbound' | 'outbound'; at: string; subject: string; body: string; attachments?: { name: string; size: string }[]; sample: true }

const EVENTS: RelationshipEventPreview[] = [
  { id: 'rel-1', kind: 'email', direction: 'outbound', at: 'Today · 12:24 pm', subject: 'Your two-instalment fee plan', body: 'Sharing the exact fee split and the Saturday batch details we discussed.', attachments: [{ name: 'Fee-plan.pdf', size: '184 KB' }], sample: true },
  { id: 'rel-2', kind: 'call', at: CALL_LOGS[0].startedAt, actor: CALL_LOGS[0].actor, durationSeconds: CALL_LOGS[0].durationSeconds, outcome: 'progressing', note: CALL_LOGS[0].note, objection: 'Price', sample: true },
  { id: 'rel-3', kind: 'message', channel: 'whatsapp', direction: 'inbound', at: 'Today · 11:42 am', body: 'Can I pay the fee in two parts?', sample: true },
  { id: 'rel-4', kind: 'email', direction: 'inbound', at: 'Yesterday · 6:10 pm', subject: 'Re: NEET repeaters — Saturday batch', body: 'Thanks, I have shared this with my parents. Is the seat held until Monday?', sample: true },
  { id: 'rel-5', kind: 'message', channel: 'instagram', direction: 'inbound', at: '29 Jul · 8:04 pm', body: 'Saw the results post. Can someone explain the mentoring?', sample: true },
  { id: 'rel-6', kind: 'call', at: CALL_LOGS[1].startedAt, actor: CALL_LOGS[1].actor, durationSeconds: CALL_LOGS[1].durationSeconds, outcome: 'callback', note: CALL_LOGS[1].note, sample: true },
]

const OUTCOME = { progressing: 'Progressing', callback: 'Callback set', closed: 'Closed', no_answer: 'No answer' } as const

export function RelationshipTimeline({ contactId }: { contactId: string }) {
  const [expanded, setExpanded] = useState<string | null>('rel-1')
  return <section aria-labelledby="relationship-title"><NextAction label="Call at 4:00 pm" detail="Confirm the two-instalment plan" /><div className="mt-5 flex items-end justify-between"><div><p className="label-caps text-accent">Full relationship · Preview</p><h3 id="relationship-title" className="mt-1 text-sm font-semibold text-fg">Calls, messages and email</h3></div><span className="text-2xs text-fg-subtle">Newest first</span></div><ol className="relative mt-4 space-y-3 before:absolute before:top-5 before:bottom-5 before:left-[17px] before:w-px before:bg-border">{EVENTS.map((event) => {
    const Icon = event.kind === 'call' ? Phone : event.kind === 'email' ? Mail : event.channel === 'instagram' ? AtSign : MessageCircle
    const open = expanded === event.id
    return <li key={event.id} className="relative flex gap-3"><span className="z-[1] flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-accent shadow-elev-1"><Icon aria-hidden size={15} /></span><button onClick={() => setExpanded(open ? null : event.id)} aria-expanded={open} className="min-w-0 flex-1 rounded-lg border border-border bg-surface p-3 text-left shadow-elev-1 hover:border-border-strong"><div className="flex items-start gap-2"><div className="min-w-0 flex-1">{event.kind === 'call' ? <><p className="text-xs font-semibold text-fg">Outbound call · {Math.floor(event.durationSeconds / 60)}m {event.durationSeconds % 60}s</p><p className="mt-1 text-2xs font-semibold text-success">{OUTCOME[event.outcome]}{event.objection ? ` · ${event.objection} objection` : ''}</p></> : event.kind === 'email' ? <><p className="truncate text-xs font-semibold text-fg">{event.subject}</p><p className="mt-1 text-2xs text-fg-muted">Email · {event.direction}</p></> : <><p className="line-clamp-1 text-xs font-semibold text-fg">“{event.body}”</p><p className="mt-1 text-2xs text-fg-muted">{event.channel} · {event.direction}</p></>}</div><span className="shrink-0 text-2xs text-fg-subtle">{event.at}</span><ChevronDown aria-hidden size={13} className={['mt-0.5 shrink-0 text-fg-subtle transition-transform', open ? 'rotate-180' : ''].join(' ')} /></div>{open && <div className="mt-3 border-t border-border pt-3">{event.kind === 'call' && <p className="text-xs leading-relaxed text-fg-muted">{event.note || 'No note added.'}</p>}{event.kind === 'email' && <><p className="text-xs leading-relaxed text-fg-muted">{event.body}</p>{event.attachments?.map((file) => <span key={file.name} className="mt-2 inline-flex items-center gap-2 rounded-md border border-border bg-surface-sunk px-2.5 py-2 text-2xs text-fg-muted"><Paperclip aria-hidden size={12} />{file.name} · {file.size}<Download aria-hidden size={12} /></span>)}</>}{event.kind === 'message' && <p className="text-xs leading-relaxed text-fg-muted">{event.body}</p>}</div>}</button></li>
  })}</ol><p className="sr-only">Relationship history preview for {contactId}</p><button className="mt-4 flex min-h-9 w-full items-center justify-center gap-1.5 text-2xs font-semibold text-fg-muted hover:text-fg"><RotateCcw aria-hidden size={12} /> Load earlier activity</button></section>
}
