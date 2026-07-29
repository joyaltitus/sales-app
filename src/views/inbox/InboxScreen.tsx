import { useCallback, useState } from 'react'
import { useClient } from '../../shell/ClientProvider'
import { useQueue, usePreviews, useThread, useLiveRefresh } from '../../lib/inbox-data'
import { EmptyState } from '../../ui/EmptyState'
import { Skeleton } from '../../ui/Skeleton'
import { QueueRow } from './QueueRow'
import { Thread } from './Thread'
import { Composer } from './Composer'

// ONE Inbox implementation, mounted by both RepShell and ManagerShell. The
// difference between the two is not a layout fork — it is a single `canSend`
// capability, plus CSS breakpoints that happen to favour each shell's usual
// device. A rep on a laptop gets the two-pane board; a manager on a phone gets
// the single-pane one. Neither is a separate code path.
//
// ⚠ ROLE-WALL NOTE (§2, the law a UI session breaks most often): `canSend` is a
// RENDERING decision only. It grants nothing and withholds nothing — hub-service
// re-derives authority from the JWT and user_client_memberships on every single
// request, and RLS governs every read underneath. Flipping this prop in a
// devtools console changes which button is painted and nothing else.

export function InboxScreen({ canSend }: { canSend: boolean }) {
  const { activeClient } = useClient()
  const clientId = activeClient?.id ?? null

  const [selectedId, setSelectedId] = useState<string | null>(null)

  const { items, loading, error, reload: reloadQueue } = useQueue(clientId)
  const { previews, reload: reloadPreviews } = usePreviews(clientId)
  const {
    messages,
    traces,
    loading: threadLoading,
    reload: reloadThread,
  } = useThread(clientId, selectedId)

  const refreshAll = useCallback(() => {
    void reloadQueue()
    void reloadPreviews()
    void reloadThread()
  }, [reloadQueue, reloadPreviews, reloadThread])

  const { channelLive } = useLiveRefresh(clientId, selectedId, refreshAll)

  const selected = items.find((i) => i.id === selectedId) ?? null
  const selectedName =
    selected?.contact?.profile_name ?? selected?.contact?.external_id ?? 'Conversation'

  if (loading) {
    return (
      <div className="space-y-2 p-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <EmptyState
          title="Couldn't load the inbox"
          body="Check your connection and try again."
        />
      </div>
    )
  }

  const queue = (
    <div className="flex min-h-0 flex-col">
      {items.length === 0 ? (
        <div className="p-6">
          {/* §1.9: empty is an invitation, not a mood. */}
          <EmptyState
            title="Nothing waiting."
            body="New WhatsApp and Instagram messages land here as they arrive."
          />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {items.map((item) => (
            <QueueRow
              key={item.id}
              item={item}
              preview={previews.get(item.id) ?? item.contact?.profile_name ?? '—'}
              selected={item.id === selectedId}
              onSelect={() => setSelectedId(item.id)}
            />
          ))}
        </div>
      )}
    </div>
  )

  const thread = selected && (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-surface px-4 py-2.5">
        {/* Phone: the thread replaces the queue, so it needs a way back. The
            two-pane desktop layout keeps both on screen and hides this. */}
        <button
          onClick={() => setSelectedId(null)}
          className="rounded-sm px-1 py-1 text-xs text-fg-muted hover:bg-surface-sunk lg:hidden"
        >
          ← Queue
        </button>
        {/* On the thread the hierarchy flips back and the NAME leads (§1.5). */}
        <span className="truncate text-md font-semibold text-fg">{selectedName}</span>
        {!channelLive && (
          <span className="ml-auto shrink-0 text-2xs text-fg-subtle">Checking for updates</span>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {threadLoading ? (
          <div className="space-y-3 p-4">
            <Skeleton className="h-12 w-2/3" />
            <Skeleton className="ml-auto h-12 w-1/2" />
          </div>
        ) : (
          <Thread messages={messages} traces={traces} />
        )}
      </div>

      <Composer conversationId={selected.id} canSend={canSend} onSent={refreshAll} />
    </div>
  )

  return (
    <div className="flex h-full min-h-0">
      {/* Below lg: one pane at a time. At lg+: the board sits beside the
          conversation, which is what §1.4's desktop diagram shows. */}
      <div
        className={[
          'min-h-0 w-full flex-col lg:flex lg:w-96 lg:shrink-0 lg:border-r lg:border-border',
          selectedId ? 'hidden lg:flex' : 'flex',
        ].join(' ')}
      >
        {queue}
      </div>

      <div className={['min-h-0 flex-1', selectedId ? 'flex' : 'hidden lg:flex'].join(' ')}>
        {thread ?? (
          <div className="hidden flex-1 items-center justify-center lg:flex">
            <EmptyState title="Pick a conversation" body="The queue is ordered by who has waited longest." />
          </div>
        )}
      </div>
    </div>
  )
}
