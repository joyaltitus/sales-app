import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Bot,
  Check,
  CheckCheck,
  Clock,
  Download,
  FileText,
  Image as ImageIcon,
  MessageCircle,
  Mic,
} from 'lucide-react'
import {
  getInboundMediaSignedUrl,
  messageKind,
  type InboundMediaRow,
  type Message,
} from '../../lib/inbox-data'
import { resolveMarks, type SeamMark, type Trace } from '../../lib/seam'
import { clockTime } from '../../lib/wait'
import { EmptyState } from '../../ui/EmptyState'

// The thread is a conversation, not a board (§1.4). Rounded, warm,
// WhatsApp-legible, generous. The seam is the ONLY board-like element that
// crosses into it.

const EMPTY_MEDIA: Map<string, InboundMediaRow> = new Map()

/** The signature: a full-bleed hairline with a micro-caps label inset into it —
 *  a legend break, not a chat bubble. The `· PRICING` suffix is the matched rule
 *  key where one exists; it answers "why" for free. */
function Seam({ mark }: { mark: SeamMark }) {
  return (
    <div className="flex items-center gap-3 py-5" role="separator">
      <span aria-hidden className="h-px flex-1 bg-border-strong" />
      <span className="shrink-0 text-2xs font-semibold whitespace-nowrap text-fg-muted">
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
    <span className="text-2xs font-medium text-fg-subtle">
      {mark.label}
      {mark.ruleKey && ` · ${mark.ruleKey}`}
    </span>
  )
}

/** Part 6 (#90): a downloaded WhatsApp attachment. Shows `fallbackText` (the
 *  same `[msg_type]` placeholder Bubble already falls back to) until the
 *  signed URL resolves, and permanently if it never does — a storage RLS
 *  deny or network failure degrades to text, never a crash or a broken icon. */
function MediaAttachment({
  storagePath,
  mime,
  msgType,
  fallbackText,
}: {
  storagePath: string
  mime: string | null
  msgType: string
  fallbackText: string
}) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setUrl(null)
    void getInboundMediaSignedUrl(storagePath).then((signed) => {
      if (!cancelled) setUrl(signed)
    })
    return () => {
      cancelled = true
    }
  }, [storagePath])

  if (!url) return <>{fallbackText}</>

  if (mime?.startsWith('image/')) {
    return (
      <a href={url} target="_blank" rel="noreferrer">
        <img src={url} alt={msgType} className="max-h-64 max-w-full rounded-md" />
      </a>
    )
  }

  if (mime?.startsWith('audio/')) {
    return <audio controls src={url} className="max-w-full" />
  }

  const kind = messageKind(msgType)
  const Icon = kind === 'image' ? ImageIcon : kind === 'audio' ? Mic : FileText
  const filename = storagePath.split('/').pop() || fallbackText

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2 text-sm underline decoration-dotted"
    >
      <Icon aria-hidden size={16} />
      {filename}
      <Download aria-hidden size={13} />
    </a>
  )
}

function Bubble({
  message,
  media,
  onRetryFailed,
}: {
  message: Message
  /** The message's downloaded attachment, if the ingestion pipeline actually
   *  stored one (#90 Part 6) — most historical media messages have none yet. */
  media?: InboundMediaRow
  /** S1 (issue #15): retry affordance for a bubble the browser sent locally
   *  and never reconciled — only wired for synthetic `optimistic:` ids;
   *  a real failed row has no client-side retry route. */
  onRetryFailed?: (id: string, body: string) => void
}) {
  // Bubbles by direction/sender_type. Inbound is the customer; outbound is
  // either the bot or a human agent, and the thread does not pretend they are
  // the same author — but it also does not shout about it, because the seam
  // already carries that story.
  const inbound = message.direction === 'inbound'
  const fromHuman = message.sender_type === 'agent'
  const failed = message.delivery_status === 'failed'
  const pending = message.delivery_status === 'pending'
  const retryable = failed && message.id.startsWith('optimistic:') && !!onRetryFailed

  const text =
    message.body ??
    message.transcription ??
    (message.msg_type !== 'text' ? `[${message.msg_type}]` : '')

  return (
    <div className={['flex flex-col', inbound ? 'items-start' : 'items-end'].join(' ')}>
      {!inbound && !fromHuman && (
        <span className="mb-1 flex items-center gap-1 px-1 text-2xs font-semibold text-accent"><Bot aria-hidden size={11} /> AI reply</span>
      )}
      <div
        className={[
          'mixed-script max-w-[86%] rounded-lg px-3.5 py-2.5 text-sm break-words shadow-elev-1 sm:max-w-[70%]',
          inbound
            ? 'rounded-bl-xs border border-border bg-surface-raised text-fg'
            : fromHuman
              ? 'rounded-br-xs bg-accent text-accent-fg'
              : 'rounded-br-xs border border-[color-mix(in_srgb,var(--accent)_24%,var(--border))] bg-accent-subtle text-fg',
          failed ? 'border border-danger' : '',
        ].join(' ')}
      >
        {media?.storage_path ? (
          <MediaAttachment
            storagePath={media.storage_path}
            mime={media.mime}
            msgType={message.msg_type}
            fallbackText={text}
          />
        ) : (
          text
        )}
        {message.transcription && message.body && (
          <div className="mt-1 text-xs text-fg-muted italic">{message.transcription}</div>
        )}
      </div>
      <div className="mt-1 flex items-center gap-2 px-1">
        <span className="tnum text-2xs text-fg-subtle" style={{ fontFamily: 'var(--font-mono)' }}>
          {clockTime(message.created_at)}
        </span>
        {!inbound && !failed && (
          pending
            ? <Clock aria-label="Sending" size={13} className="text-fg-subtle" />
            : message.delivery_status === 'read'
              ? <CheckCheck aria-label="Read" size={13} className="text-info" />
              : <Check aria-label={message.delivery_status || 'Sent'} size={13} className="text-fg-subtle" />
        )}
        {failed && retryable && (
          <button
            type="button"
            onClick={() => onRetryFailed?.(message.id, message.body ?? '')}
            className="text-2xs text-danger underline decoration-dotted hover:text-danger"
          >
            {message.failure_reason ?? "Didn't send"} · Tap to retry
          </button>
        )}
        {failed && !retryable && (
          <span className="text-2xs text-danger">
            {message.failure_reason ?? "Didn't send"}
          </span>
        )}
      </div>
    </div>
  )
}

export function Thread({
  messages,
  traces,
  onRetryFailed,
  media = EMPTY_MEDIA,
}: {
  messages: Message[]
  traces: Trace[]
  /** channel_message_id -> downloaded attachment (#90 Part 6). Optional so the
   *  The design-gallery caller (without live inbound_media reads) is unaffected. */
  media?: Map<string, InboundMediaRow>
  onRetryFailed?: (id: string, body: string) => void
}) {
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

  if (messages.length === 0) {
    return <EmptyState icon={MessageCircle} title="No messages here yet." body="This conversation is ready. Send the first message below or return to the queue." />
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 p-4 py-6 sm:px-6">
      {messages.map((m, index) => (
        <div key={m.id} className="flex flex-col gap-3">
          {(index === 0 || new Date(messages[index - 1].created_at).toDateString() !== new Date(m.created_at).toDateString()) && (
            <div className="flex items-center gap-3 py-2" role="separator">
              <span className="h-px flex-1 bg-border" />
              <span className="rounded-pill border border-border bg-surface-glass px-2.5 py-1 text-2xs font-semibold text-fg-muted shadow-elev-1">
                {new Date(m.created_at).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}
              </span>
              <span className="h-px flex-1 bg-border" />
            </div>
          )}
          {marksBefore.get(m.id)?.map((mark) => <Seam key={mark.id} mark={mark} />)}
          <Bubble
            message={m}
            media={m.channel_message_id ? media.get(m.channel_message_id) : undefined}
            onRetryFailed={onRetryFailed}
          />
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
