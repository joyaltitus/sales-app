import { useEffect, useState } from 'react'
import { AtSign, ChevronDown, MessageCircle, Phone } from 'lucide-react'
import { useClient } from '../../shell/ClientProvider'
import { useCallLogs } from '../../lib/calls-data'
import { supabase } from '../../lib/supabase'

const MESSAGE_LIMIT = 100

const CALL_OUTCOME_LABEL: Record<string, string> = {
  closed: 'Closed', progressing: 'Progressing', objection: 'Objection', no_answer: 'No answer', callback: 'Callback set',
}

type TimelineEvent =
  | { id: string; kind: 'call'; at: string; actor: string | null; outcome: string; note: string | null }
  | { id: string; kind: 'message'; channel: 'whatsapp' | 'instagram'; direction: 'inbound' | 'outbound'; at: string; body: string }

function useContactMessages(clientId: string | null, contactId: string | null) {
  const [messages, setMessages] = useState<{ id: string; direction: string; body: string | null; created_at: string }[]>([])
  const [channel, setChannel] = useState<'whatsapp' | 'instagram'>('whatsapp')

  useEffect(() => {
    if (!clientId || !contactId) {
      setMessages([])
      return
    }
    let cancelled = false
    void (async () => {
      const [contactRes, convRes] = await Promise.all([
        supabase.from('contacts').select('channel').eq('client_id', clientId).eq('id', contactId).single(),
        supabase.from('conversations').select('id').eq('client_id', clientId).eq('contact_id', contactId),
      ])
      if (cancelled) return
      if (contactRes.data?.channel === 'instagram') setChannel('instagram')
      const convIds = (convRes.data ?? []).map((c) => (c as { id: string }).id)
      if (!convIds.length) {
        setMessages([])
        return
      }
      const { data: msgs } = await supabase
        .from('messages')
        .select('id, direction, body, created_at')
        .in('conversation_id', convIds)
        .order('created_at', { ascending: false })
        .limit(MESSAGE_LIMIT)
      if (!cancelled) setMessages((msgs ?? []) as { id: string; direction: string; body: string | null; created_at: string }[])
    })()
    return () => {
      cancelled = true
    }
  }, [clientId, contactId])

  return { messages, channel }
}

export function RelationshipTimeline({ contactId }: { contactId: string }) {
  const { activeClient } = useClient()
  const clientId = activeClient?.id ?? null
  const [expanded, setExpanded] = useState<string | null>(null)
  const { items: calls } = useCallLogs(clientId, contactId)
  const { messages, channel } = useContactMessages(clientId, contactId)

  const callEvents: TimelineEvent[] = calls.map((c) => ({
    id: c.id,
    kind: 'call',
    at: c.occurred_at,
    actor: c.actorName,
    outcome: CALL_OUTCOME_LABEL[c.outcome] ?? c.outcome,
    note: c.note,
  }))
  const messageEvents: TimelineEvent[] = messages
    .filter((m) => m.body)
    .map((m) => ({
      id: m.id,
      kind: 'message',
      channel,
      direction: m.direction === 'outbound' ? 'outbound' : 'inbound',
      at: m.created_at,
      body: m.body as string,
    }))

  const timeMs = (at: string) => {
    const parsed = Date.parse(at)
    return Number.isNaN(parsed) ? 0 : parsed
  }
  const events = [...callEvents, ...messageEvents].sort((a, b) => timeMs(b.at) - timeMs(a.at))

  const formatAt = (event: TimelineEvent) =>
    new Date(event.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

  return (
    <section aria-labelledby="relationship-title">
      <div className="flex items-end justify-between">
        <div><p className="label-caps text-accent">Activity</p><h3 id="relationship-title" className="mt-1 text-sm font-semibold text-fg">Calls and messages</h3></div>
        <span className="text-2xs text-fg-subtle">Newest first</span>
      </div>
      {events.length === 0 && <p className="mt-4 text-xs text-fg-subtle">No activity on record yet.</p>}
      <ol className="relative mt-4 space-y-3 before:absolute before:top-5 before:bottom-5 before:left-[17px] before:w-px before:bg-border">
        {events.map((event) => {
          const Icon = event.kind === 'call' ? Phone : event.channel === 'instagram' ? AtSign : MessageCircle
          const open = expanded === event.id
          return (
            <li key={event.id} className="relative flex gap-3">
              <span className="z-[1] flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-accent shadow-elev-1"><Icon aria-hidden size={15} /></span>
              <button onClick={() => setExpanded(open ? null : event.id)} aria-expanded={open} className="min-w-0 flex-1 rounded-lg border border-border bg-surface p-3 text-left shadow-elev-1 hover:border-border-strong">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    {event.kind === 'call' ? (
                      <>
                        <p className="text-xs font-semibold text-fg">Call{event.actor ? ` · ${event.actor}` : ''}</p>
                        <p className="mt-1 text-2xs font-semibold text-success">{event.outcome}</p>
                      </>
                    ) : (
                      <>
                        <p className="line-clamp-1 text-xs font-semibold text-fg">“{event.body}”</p>
                        <p className="mt-1 text-2xs text-fg-muted">{event.channel} · {event.direction}</p>
                      </>
                    )}
                  </div>
                  <span className="shrink-0 text-2xs text-fg-subtle">{formatAt(event)}</span>
                  <ChevronDown aria-hidden size={13} className={['mt-0.5 shrink-0 text-fg-subtle transition-transform', open ? 'rotate-180' : ''].join(' ')} />
                </div>
                {open && (
                  <div className="mt-3 border-t border-border pt-3">
                    {event.kind === 'call' && <p className="text-xs leading-relaxed text-fg-muted">{event.note || 'No note added.'}</p>}
                    {event.kind === 'message' && <p className="text-xs leading-relaxed text-fg-muted">{event.body}</p>}
                  </div>
                )}
              </button>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
