import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ConversationSnippet, QueueItem } from '../../lib/inbox-data'
import { QueueRow } from '../inbox/QueueRow'
import { useRolePath } from '../../shell/RoleRouter'

// Shared furniture for the three landings (SA-03). Each landing answers ONE
// question (direction §1.11) and none of them is a stat grid, so what they
// share is a section header and a bounded list of the SAME queue row the Inbox
// uses — never a second, divergent row component (S4-AMENDMENT #1).

export function SectionHeader({
  title,
  count,
  hint,
}: {
  title: string
  count?: number
  hint?: string
}) {
  return (
    <div className="flex items-baseline gap-2 px-4 pt-5 pb-2">
      <h2
        className="label-caps text-fg-muted"
        style={{ fontWeight: 'var(--weight-caps)', letterSpacing: 'var(--tracking-caps)' }}
      >
        {title}
      </h2>
      {count !== undefined && count > 0 && (
        <span className="tnum text-xs text-fg-subtle" style={{ fontFamily: 'var(--font-mono)' }}>
          {count}
        </span>
      )}
      {hint && <span className="ml-auto truncate text-2xs text-fg-subtle">{hint}</span>}
    </div>
  )
}

/** A quiet one-liner for a section with nothing in it. §1.9: empty is an
 *  invitation, not a mood — and on a landing it is usually GOOD news, so it
 *  must not look like a failure. */
export function SectionEmpty({ children }: { children: ReactNode }) {
  return (
    <p className="border-b border-border bg-surface px-4 py-3 text-xs text-fg-subtle">{children}</p>
  )
}

/**
 * A bounded list of conversations that hands the chosen thread to the Inbox.
 *
 * `LIST_CAP` is a display ceiling on an already-bounded read, not a page-1 of
 * infinite scroll (§1.10 #9). When it bites, the count in the header still
 * shows the true total and the footer says so — a landing that silently shows
 * 8 of 40 is worse than one that admits it.
 */
const LIST_CAP = 8

export function ThreadList({
  items,
  snippets,
  cap = LIST_CAP,
}: {
  items: QueueItem[]
  snippets: Map<string, ConversationSnippet>
  cap?: number
}) {
  const navigate = useNavigate()
  const rolePath = useRolePath()
  const shown = items.slice(0, cap)

  return (
    <div>
      {shown.map((item) => (
        <QueueRow
          key={item.id}
          item={item}
          snippet={snippets.get(item.id)?.text ?? item.contact?.profile_name ?? '—'}
          snippetKind={snippets.get(item.id)?.kind ?? 'text'}
          selected={false}
          onSelect={() => navigate(rolePath(`/inbox?c=${item.id}`))}
        />
      ))}
      {items.length > cap && (
        <button
          onClick={() => navigate(rolePath('/inbox'))}
          className="w-full border-b border-border bg-surface px-4 py-2.5 text-left text-xs text-fg-muted hover:bg-surface-sunk"
        >
          {items.length - cap} more in the Inbox →
        </button>
      )}
    </div>
  )
}
