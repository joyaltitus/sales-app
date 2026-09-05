import { useMemo, useState } from 'react'
import { MessageSquareText, Mic } from 'lucide-react'
import type { ChatMessage } from '../lib/wa-chat'
import { noteFromMessages } from '../lib/wa-chat'
import { Button } from '../../src/ui/Button'
import { Chip } from '../../src/ui/Chip'
import { EmptyState } from '../../src/ui/EmptyState'

type Props = {
  chatName: string
  messages: ChatMessage[]
  loading?: boolean
  busy?: boolean
  message?: string | null
  onSave: (selected: ChatMessage[], body: string) => void
  onCancel: () => void
}

/**
 * The review step between "read the chat" and "write to the CRM".
 *
 * Nothing here saves on its own. The rep unticks what should not be stored,
 * reads the exact note body that will be written, and confirms — which is what
 * makes the rep, not the extension, the party who decided this personal data
 * goes into the database.
 */
export function ConversationReview({
  chatName,
  messages,
  loading,
  busy,
  message,
  onSave,
  onCancel,
}: Props) {
  const [excluded, setExcluded] = useState<Set<string>>(new Set())

  const selected = useMemo(
    () => messages.filter((item) => !excluded.has(item.id)),
    [excluded, messages],
  )
  const body = useMemo(() => noteFromMessages(selected, chatName), [chatName, selected])

  function toggle(id: string) {
    setExcluded((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (loading) {
    return (
      <section className="rounded-lg border border-border bg-surface-raised p-3 text-xs text-fg-muted shadow-elev-1" role="status">
        Reading the messages on screen…
      </section>
    )
  }

  if (messages.length === 0) {
    return (
      <section className="rounded-lg border border-border bg-surface-raised shadow-elev-1">
        <EmptyState
          title="No messages on screen"
          body="Open the chat in WhatsApp Web and scroll to what you want to keep, then try again."
        />
        <div className="p-3 pt-0">
          <Button variant="secondary" className="min-h-11 w-full" onClick={onCancel}>
            Close
          </Button>
        </div>
      </section>
    )
  }

  return (
    <section className="rounded-lg border border-border bg-surface-raised shadow-elev-1">
      <header className="flex items-center gap-2 border-b border-border px-3 py-2">
        <MessageSquareText aria-hidden size={15} strokeWidth={1.9} className="shrink-0 text-fg-subtle" />
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">Save this conversation</h2>
        <Chip tone={selected.length ? 'accent' : 'neutral'}>{selected.length} of {messages.length}</Chip>
      </header>

      <p className="px-3 pt-2 text-xs leading-relaxed text-fg-muted">
        Untick anything that shouldn’t go into the CRM. Saved as one note on this lead.
      </p>

      <ul className="mt-1" aria-label="Messages to save">
        {messages.map((item) => {
          const on = !excluded.has(item.id)
          return (
            <li key={item.id}>
              <label className="flex min-h-11 cursor-pointer items-start gap-2.5 border-b border-border px-3 py-2 hover:bg-surface-sunk">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => toggle(item.id)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
                  aria-label={`Include ${item.voice ? 'voice note' : item.text.slice(0, 40)}`}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="label-caps">{item.direction === 'in' ? 'Them' : 'You'}</span>
                    {item.at && <span className="text-2xs text-fg-subtle tnum">{item.at}</span>}
                  </span>
                  {item.voice ? (
                    <span className="mt-0.5 inline-flex items-center gap-1 text-xs text-fg-muted">
                      <Mic aria-hidden size={12} strokeWidth={1.9} />
                      voice note, {item.voice}
                    </span>
                  ) : (
                    <span className={['mt-0.5 block text-xs leading-relaxed', on ? 'text-fg-muted' : 'text-fg-subtle line-through'].join(' ')}>
                      {item.text}
                    </span>
                  )}
                </span>
              </label>
            </li>
          )
        })}
      </ul>

      {message && (
        <p role="status" className="mx-3 mt-2 rounded-md border border-border bg-surface-sunk px-3 py-2 text-xs text-fg-muted">
          {message}
        </p>
      )}

      <div className="flex gap-2 p-3">
        <Button variant="secondary" className="min-h-11 flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          className="min-h-11 flex-1"
          loading={busy}
          disabled={selected.length === 0 || busy}
          onClick={() => onSave(selected, body)}
        >
          Save to CRM
        </Button>
      </div>
    </section>
  )
}
