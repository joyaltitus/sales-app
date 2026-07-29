import { useEffect, useMemo, useRef } from 'react'
import type { Message } from '../../lib/inbox-data'
import { resolveMarks, type SeamMark, type Trace } from '../../lib/seam'
import { clockTime } from '../../lib/wait'

// The thread is a conversation, not a board (§1.4). Rounded, warm,
// WhatsApp-legible, generous. The seam is the ONLY board-like element that
// crosses into it.

/** The signature: a full-bleed hairline with a micro-caps label inset into it —
 *  a legend break, not a chat bubble. The `· PRICING` suffix is the matched rule
 *  key where one exists; it answers "why" for free. */
function Seam({ mark }: { mark: SeamMark }) {
  return (
    <div className="flex items-center gap-3 py-5" role="separator">
      <span aria-hidden className="h-px flex-1 bg-border-strong" />
      <span
        className="shrink-0 text-2xs whitespace-nowrap text-fg-muted uppercase"
        style={{ fontWeight: 'var(--weight-caps)', letterSpacing: 'var(--tracking-caps)' }}
      >
        {mark.label}
        {mark.ruleKey && <span className="text-fg-subtle"> · {mark.ruleKey}</span>}
      </span>
      <span aria-hidden className="h-px flex-1 bg-border-strong" />
    </div>
  )
}

/** deflect / playbook / media get an inline tag on the bot's message, never a
 *  hairline — those are the machine working normally, not a handover. */
function InlineTag({ mark }: { mark: SeamMark }) {
  return (
    <span
      className="text-2xs text-fg-subtle uppercase"
      style={{ fontWeight: 'var(--weight-caps)', letterSpacing: 'var(--tracking-caps)' }}
    >
      {mark.label}
      {mark.ruleKey && ` · ${mark.ruleKey}`}
    </span>
  )
}

function Bubble({ message }: { message: Message }) {
  // Bubbles by direction/sender_type. Inbound is the customer; outbound is
  // either the bot or a human agent, and the thread does not pretend they are
  // the same author — but it also does not shout about it, because the seam
  // already carries that story.
  const inbound = message.direction === 'inbound'
  const fromHuman = message.sender_type === 'agent'
  const failed = message.delivery_status === 'failed'

  const text =
    message.body ??
    message.transcription ??
    (message.msg_type !== 'text' ? `[${message.msg_type}]` : '')

  return (
    <div className={['flex flex-col', inbound ? 'items-start' : 'items-end'].join(' ')}>
      <div
        className={[
          'max-w-[85%] rounded-md px-3 py-2 text-sm break-words sm:max-w-[70%]',
          inbound
            ? 'bg-surface-sunk text-fg'
            : fromHuman
              ? 'bg-accent-subtle text-fg'
              : 'border border-border bg-surface text-fg',
          failed ? 'border border-danger' : '',
        ].join(' ')}
      >
        {text}
        {message.transcription && message.body && (
          <div className="mt-1 text-xs text-fg-muted italic">{message.transcription}</div>
        )}
      </div>
      <div className="mt-1 flex items-center gap-2 px-1">
        <span className="tnum text-2xs text-fg-subtle" style={{ fontFamily: 'var(--font-mono)' }}>
          {clockTime(message.created_at)}
        </span>
        {!inbound && !fromHuman && (
          <span
            className="text-2xs text-fg-subtle uppercase"
            style={{ fontWeight: 'var(--weight-caps)', letterSpacing: 'var(--tracking-caps)' }}
          >
            Bot
          </span>
        )}
        {failed && (
          <span className="text-2xs text-danger">
            {message.failure_reason ?? "Didn't send"}
          </span>
        )}
      </div>
    </div>
  )
}

export function Thread({ messages, traces }: { messages: Message[]; traces: Trace[] }) {
  const endRef = useRef<HTMLDivElement>(null)

  // Marks are resolved once per trace list, then placed against the message
  // timeline: a trace belongs immediately BEFORE the first message at or after
  // its own created_at — which is exactly where §1.3's diagram puts the seam,
  // after the last customer line and before the reply.
  const { marksBefore, tagsFor, trailing } = useMemo(() => {
    const marks = resolveMarks(traces)
    const before = new Map<string, SeamMark[]>()
    const tags = new Map<string, SeamMark[]>()
    const tail: SeamMark[] = []

    for (const t of traces) {
      const mark = marks.get(t.id)
      if (!mark) continue
      const target = messages.find((m) => m.created_at >= t.created_at)
      if (mark.kind === 'tag') {
        // An inline tag describes the bot message it produced.
        const owner = target ?? messages[messages.length - 1]
        if (!owner) continue
        tags.set(owner.id, [...(tags.get(owner.id) ?? []), mark])
        continue
      }
      if (!target) {
        // A seam after the final message — the common case for "handed to you",
        // where the whole point is that no reply has been sent yet.
        tail.push(mark)
        continue
      }
      before.set(target.id, [...(before.get(target.id) ?? []), mark])
    }
    return { marksBefore: before, tagsFor: tags, trailing: tail }
  }, [messages, traces])

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length])

  return (
    <div className="flex flex-col gap-3 p-4">
      {messages.map((m) => (
        <div key={m.id} className="flex flex-col gap-3">
          {marksBefore.get(m.id)?.map((mark) => <Seam key={mark.id} mark={mark} />)}
          <Bubble message={m} />
          {tagsFor.get(m.id) && (
            <div className="flex justify-end gap-2 px-1">
              {tagsFor.get(m.id)?.map((mark) => <InlineTag key={mark.id} mark={mark} />)}
            </div>
          )}
        </div>
      ))}
      {trailing.map((mark) => (
        <Seam key={mark.id} mark={mark} />
      ))}
      <div ref={endRef} />
    </div>
  )
}
