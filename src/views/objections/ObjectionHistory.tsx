import { Check, Clock3, MessageCircle, PhoneCall, UserRound } from 'lucide-react'
import { OBJECTION_HISTORY } from './objectionMocks'

const SOURCE_ICON = { chat: MessageCircle, crm: UserRound, call: PhoneCall } as const

export function ObjectionHistory({ contactId }: { contactId: string }) {
  return (
    <section className="border-t border-border pt-4" aria-labelledby="objection-history-title">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="label-caps text-accent">Pattern over time</p>
          <h3 id="objection-history-title" className="mt-1 text-sm font-semibold text-fg">Objection history</h3>
        </div>
        <span className="text-2xs text-fg-muted">Preview — not wired</span>
      </div>
      <ol className="relative mt-4 space-y-0 before:absolute before:top-4 before:bottom-4 before:left-[15px] before:w-px before:bg-border">
        {OBJECTION_HISTORY.map((item) => {
          const Icon = SOURCE_ICON[item.source]
          return (
            <li key={item.id} className="relative flex gap-3 pb-4 last:pb-0">
              <span className="z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-fg-muted"><Icon aria-hidden size={14} /></span>
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-fg">{item.label}</span>
                  <span className={['inline-flex items-center gap-1 text-2xs font-semibold', item.resolved ? 'text-success' : 'text-warn'].join(' ')}>{item.resolved ? <Check aria-hidden size={11} /> : <Clock3 aria-hidden size={11} />}{item.resolved ? 'Resolved' : 'Open'}</span>
                </div>
                {item.note && <p className="mt-1 text-xs leading-relaxed text-fg-muted">“{item.note}”</p>}
                <p className="mt-1 text-2xs text-fg-subtle">{item.occurredAt} · {item.actor}</p>
              </div>
            </li>
          )
        })}
      </ol>
      <span className="sr-only">Preview history for {contactId}</span>
    </section>
  )
}
