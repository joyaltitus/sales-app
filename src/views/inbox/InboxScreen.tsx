import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { Search, Inbox as InboxIcon, MessageCircle, ArrowLeft, PanelRight, Radio, X } from 'lucide-react'
import { useClient } from '../../shell/ClientProvider'
import { useAuth } from '../../auth/AuthProvider'
import { useQueue, useSnippets, useThread, useLiveRefresh, mergeOutbound, newOptimisticId, isWindowClosed } from '../../lib/inbox-data'
import type { QueueItem, OptimisticBubble, Message } from '../../lib/inbox-data'
import { useTeammates, teammateLabel, useConvLead } from '../../lib/crm-data'
import { markConversationRead } from '../../lib/crm-actions'
import { EmptyState } from '../../ui/EmptyState'
import { Skeleton } from '../../ui/Skeleton'
import { QueueRow } from './QueueRow'
import { Thread } from './Thread'
import { Composer } from './Composer'
import { ContextRail } from './ContextRail'
import { Sheet } from '../../ui/Sheet'
import { CallButton } from '../calls/CallButton'
import { ErrorState } from '../../ui/ErrorState'
import { ErrorBoundary } from '../../ui/ErrorBoundary'
import { formatPhone } from '../../lib/phone'

// SA-04 Inbox parity (real, not mock — §S6 item 2): channel tabs, status
// chips, search. ALL of it is client-side filtering over the already-fetched
// bounded queue (200 rows) — the reads, RLS and realtime underneath are
// untouched. Filter semantics match Workbench's Inbox.tsx exactly:
//   open        → status === 'open'
//   needs_human → bot_paused && !escalation_resolved
//   unread      → unread_count > 0
//   closed      → status !== 'open'
// Channel matches on contacts.channel ?? 'whatsapp' (same fallback).
type StatusFilter = 'open' | 'needs_human' | 'unread' | 'closed' | 'all'
type ChannelFilter = '' | 'whatsapp' | 'instagram'

const STATUS_CHIPS: { key: StatusFilter; label: string }[] = [
  { key: 'open', label: 'Open' },
  { key: 'needs_human', label: 'Needs human' },
  { key: 'unread', label: 'Unread' },
  { key: 'closed', label: 'Closed' },
  { key: 'all', label: 'All' },
]

const CHANNEL_TABS: { key: ChannelFilter; label: string }[] = [
  { key: '', label: 'All' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'instagram', label: 'Instagram' },
]

function matchesStatus(item: QueueItem, f: StatusFilter): boolean {
  switch (f) {
    case 'open':
      return item.status === 'open'
    case 'needs_human':
      return item.bot_paused && !item.escalation_resolved
    case 'unread':
      return item.unread_count > 0
    case 'closed':
      return item.status !== 'open'
    case 'all':
      return true
  }
}

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
  const { session } = useAuth()
  const clientId = activeClient?.id ?? null
  const userId = session?.user?.id ?? null
  const role = activeClient?.role ?? null

  // `?c=<conversation_id>` is how a landing hands a thread over (SA-03). The
  // open thread stays LOCAL state — clicking around the queue must not rewrite
  // history on every row — so the param seeds it rather than driving it. With
  // no param this is exactly the previous behaviour: null.
  const [searchParams, setSearchParams] = useSearchParams()
  const deepLinkId = searchParams.get('c')
  const [selectedId, setSelectedId] = useState<string | null>(() => deepLinkId)

  // Channel tab is URL-backed (§S6 item 2, same param Workbench uses) so a
  // filtered view survives refresh and can be linked. Status + search stay
  // local — they are working state, not an address.
  const rawChannel = searchParams.get('channel')
  const channel: ChannelFilter =
    rawChannel === 'whatsapp' || rawChannel === 'instagram' ? rawChannel : ''
  const setChannel = (next: ChannelFilter) => {
    const params = new URLSearchParams(searchParams)
    if (next) params.set('channel', next)
    else params.delete('channel')
    setSearchParams(params, { replace: true })
  }
  const [status, setStatus] = useState<StatusFilter>('open')
  const [query, setQuery] = useState('')

  // SA-06 "My inbox": chats labeled to me (`conversations.assigned_to`).
  // Desktop roles land on All and may switch.
  //
  // AT-33 amends SA-06 for reps only: a rep no longer gets "All one tap away".
  // The floor for a tenant-wide view is manager, so below it the scope is fixed
  // at 'my' and the toggle is not painted — offering a control whose only effect
  // is to show work that is not yours is not a shortcut, it is the absence of
  // the scoping this AT exists to add.
  //
  // RENDERING SCOPE ONLY, and deliberately so: `conversations` SELECT stays
  // tenant-wide under RLS for every role (MASTER-PLAN §B), because the extension
  // and the assignment controls both need to resolve rows the rep does not own.
  // Hiding a row grants nothing and withholds nothing — this is product
  // behaviour, and the test for it proves the FILTER, never the wall.
  const repScoped = role === 'agent'
  const [scope, setScope] = useState<'my' | 'all'>(repScoped ? 'my' : 'all')
  const { items: teammates } = useTeammates(clientId)
  const labelFor = useCallback(
    (assignedTo: string | null): string | null => {
      if (!assignedTo) return null
      if (assignedTo === userId) return 'You'
      const t = teammates.find((x) => x.user_id === assignedTo)
      return t ? teammateLabel(t) : 'Assigned'
    },
    [userId, teammates],
  )

  // SA-05 context rail: its own pane at xl+, a sheet below that. The AI draft
  // seeds the composer through this counter-keyed value (a bare string could
  // not be "used twice").
  // Inline pane defaults open at xl+ (old always-on behavior), closed as a
  // sheet below xl — but now toggleable either way, matching the button.
  const [railOpen, setRailOpen] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1280)
  const [draftSeed, setDraftSeed] = useState<{ n: number; text: string } | null>(null)

  // S1 (issue #15, AT-01..AT-08): outbound bubbles the browser has sent but
  // hub-service has not yet persisted. Lives here, not in Composer, because
  // Thread (a sibling) needs the merged view. Cleared on conversation switch
  // — a pending/failed bubble belongs to the thread it was typed into.
  const [optimistic, setOptimistic] = useState<OptimisticBubble[]>([])
  const readAttempts = useRef(new Set<string>())

  // S11: a notification tap arrives with the AI draft in router state (prose,
  // not an address — it does not belong in the query string). Seed the composer
  // once, then clear the state so a refresh or a Back does not re-insert it.
  const { state: navState } = useLocation()
  const handedDraft = (navState as { draft?: string } | null)?.draft ?? null
  useEffect(() => {
    if (!handedDraft) return
    setDraftSeed((prev) => ({ n: (prev?.n ?? 0) + 1, text: handedDraft }))
    window.history.replaceState({}, '')
  }, [handedDraft])

  // Seeding on mount alone is not enough. React Router keeps this component
  // mounted when only the query string changes, so a second hand-off to a
  // DIFFERENT thread (back to a landing, tap another row) would arrive with the
  // first thread still open. Track which param value has been consumed and
  // honour each new one exactly once, which leaves manual queue clicks alone.
  const consumed = useRef<string | null>(deepLinkId)
  useEffect(() => {
    if (deepLinkId && deepLinkId !== consumed.current) {
      consumed.current = deepLinkId
      setSelectedId(deepLinkId)
    }
  }, [deepLinkId])

  const { items, loading, error, reload: reloadQueue } = useQueue(clientId)
  const { snippets, reload: reloadSnippets } = useSnippets(clientId)
  const {
    messages,
    traces,
    media,
    loading: threadLoading,
    error: threadError,
    reload: reloadThread,
    setMessages: setThreadMessages,
  } = useThread(clientId, selectedId)

  // A conversation switch already fully reloads `messages` (useThread's own
  // effect), so the only transient state that needs its own reset here is
  // the outbound bubbles this screen owns.
  useEffect(() => setOptimistic([]), [selectedId])

  const refreshAll = useCallback(() => {
    void reloadQueue()
    void reloadSnippets()
    void reloadThread()
  }, [reloadQueue, reloadSnippets, reloadThread])

  // S1: paint an inbound Realtime INSERT into the open thread immediately —
  // no waiting on the 400ms debounced full refetch below. Ignored for any
  // other conversation (and cross-tenant rows never reach here at all: the
  // channel's `client_id=eq.` filter keeps them off the wire). Deduped by id
  // so redundant delivery on reconnect is a no-op.
  const onMessageInsert = useCallback(
    (row: Message & { conversation_id: string }) => {
      if (row.conversation_id !== selectedId) return
      setThreadMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]))
    },
    [selectedId, setThreadMessages],
  )

  const { channelLive, connectionState } = useLiveRefresh(clientId, refreshAll, onMessageInsert)

  const onOptimisticSend = useCallback((body: string) => {
    const tempId = newOptimisticId()
    setOptimistic((prev) => [...prev, { tempId, body, status: 'pending', createdAt: new Date().toISOString() }])
    return tempId
  }, [])
  const onOptimisticSettle = useCallback((tempId: string, ok: boolean) => {
    if (ok) return // stays pending until an authoritative row reconciles it (mergeOutbound)
    setOptimistic((prev) => prev.map((b) => (b.tempId === tempId ? { ...b, status: 'failed' } : b)))
  }, [])
  // Named for what it does: drop the failed bubble and put its text back in the
  // composer. It is not a resend, and the button no longer claims to be one.
  const onCopyToComposer = useCallback((tempId: string, body: string) => {
    setOptimistic((prev) => prev.filter((b) => b.tempId !== tempId))
    setDraftSeed((prev) => ({ n: (prev?.n ?? 0) + 1, text: body }))
  }, [])
  const displayMessages = useMemo(() => mergeOutbound(messages, optimistic), [messages, optimistic])

  // Client-side filter over the already-fetched bounded list. The needs-human
  // count is over the channel-filtered set so the badge agrees with the list
  // the chip would show.
  const scopedItems = useMemo(
    () => (scope === 'my' ? items.filter((i) => i.assigned_to === userId) : items),
    [items, scope, userId],
  )
  const channelItems = useMemo(
    () =>
      channel
        ? scopedItems.filter((i) => (i.contact?.channel ?? 'whatsapp') === channel)
        : scopedItems,
    [scopedItems, channel],
  )
  const needsHumanCount = useMemo(
    () => channelItems.filter((i) => matchesStatus(i, 'needs_human')).length,
    [channelItems],
  )
  const unreadCount = useMemo(
    () => channelItems.filter((i) => matchesStatus(i, 'unread')).length,
    [channelItems],
  )
  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase()
    return channelItems.filter((i) => {
      if (!matchesStatus(i, status)) return false
      if (!q) return true
      const name = i.contact?.profile_name?.toLowerCase() ?? ''
      const ext = i.contact?.external_id?.toLowerCase() ?? ''
      return name.includes(q) || ext.includes(q)
    })
  }, [channelItems, status, query])

  const myUnreadCount = useMemo(
    () => items.filter((i) => i.assigned_to === userId && i.unread_count > 0).length,
    [items, userId],
  )
  const waUnreadCount = useMemo(
    () => scopedItems.filter((i) => (i.contact?.channel ?? 'whatsapp') === 'whatsapp' && i.unread_count > 0).length,
    [scopedItems],
  )
  const igUnreadCount = useMemo(
    () => scopedItems.filter((i) => i.contact?.channel === 'instagram' && i.unread_count > 0).length,
    [scopedItems],
  )
  // Mark open conversation as read when actively viewed
  useEffect(() => {
    if (!clientId || !selectedId) return
    const target = items.find((i) => i.id === selectedId)
    if (!target || target.unread_count <= 0) return
    const attempt = `${clientId}:${selectedId}:${target.unread_count}:${target.last_customer_message_at ?? ''}`
    if (readAttempts.current.has(attempt)) return
    readAttempts.current.add(attempt)
    void markConversationRead(clientId, selectedId)
  }, [clientId, selectedId, items])

  // Selection is looked up in the UNFILTERED list on purpose: a landing can
  // deep-link a closed conversation while the queue shows Open — the thread
  // must still render even though its row is filtered out.
  const selected = items.find((i) => i.id === selectedId) ?? null
  const selectedName =
    selected?.contact?.profile_name ?? formatPhone(selected?.contact?.external_id) ?? 'Conversation'
  const { lead } = useConvLead(clientId, selected?.contact_id ?? null)

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

  const filterBar = (
    <div className="shrink-0 space-y-3 border-b border-border bg-surface px-4 pt-4 pb-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold tracking-[-0.025em] text-fg">Inbox</h1>
            {channelLive && <span className="flex items-center gap-1 text-2xs font-semibold text-success"><Radio aria-hidden size={11} /> Live</span>}
          </div>
          <p className="mt-0.5 text-2xs text-fg-muted">{visibleItems.length} conversations in view</p>
        </div>
        {needsHumanCount > 0 && <span className="tnum rounded-pill bg-danger-subtle px-2 py-1 text-2xs font-semibold text-danger">{needsHumanCount} need you</span>}
      </div>
      {/* Scope + channel controls. */}
      <div className="no-scrollbar flex items-center gap-2 overflow-x-auto">
        {!repScoped && (
        <div
          role="tablist"
          aria-label="Inbox scope"
          className="flex shrink-0 rounded-md border border-border bg-surface-sunk p-0.5"
        >
          {(
            [
              ['my', 'My inbox', myUnreadCount > 0],
              ['all', 'All', false],
            ] as const
          ).map(([key, label, hasUnread]) => (
            <button
              key={key}
              role="tab"
              aria-selected={scope === key}
              onClick={() => setScope(key)}
              className={[
                'inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-xs font-medium transition-colors',
                scope === key ? 'bg-surface-raised text-fg shadow-elev-1' : 'text-fg-muted hover:text-fg',
              ].join(' ')}
            >
              <span>{label}</span>
              {hasUnread && (
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                  aria-hidden="true"
                  data-testid={`unread-dot-${key}`}
                />
              )}
            </button>
          ))}
        </div>
        )}
        <div
          role="tablist"
          aria-label="Channel"
          className="flex shrink-0 rounded-md border border-border bg-surface-sunk p-0.5"
        >
          {CHANNEL_TABS.map((t) => {
            const hasUnread =
              t.key === 'whatsapp'
                ? waUnreadCount > 0
                : t.key === 'instagram'
                  ? igUnreadCount > 0
                  : false

            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={channel === t.key}
                onClick={() => setChannel(t.key)}
                className={[
                  'inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-xs font-medium transition-colors',
                  channel === t.key
                    ? 'bg-surface-raised text-fg shadow-elev-1'
                    : 'text-fg-muted hover:text-fg',
                ].join(' ')}
              >
                <span>{t.label}</span>
                {hasUnread && (
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                    aria-hidden="true"
                    data-testid={`unread-dot-${t.key}`}
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>
      {/* Search on its own line — three controls plus a usable input don't
          share 390px. */}
      <div className="relative">
        <Search
          aria-hidden
          size={14}
          strokeWidth={1.75}
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-fg-subtle"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name or number"
          aria-label="Search conversations"
          className="h-10 w-full rounded-md border border-border bg-surface-raised pr-3 pl-9 text-sm text-fg shadow-[var(--inset-highlight)] transition-colors placeholder:text-fg-subtle hover:border-border-strong"
        />
      </div>
      {/* Status chips — horizontal scroll on phone, wraps nowhere. */}
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto" role="group" aria-label="Status filter">
        {STATUS_CHIPS.map((c) => (
          <button
            key={c.key}
            aria-pressed={status === c.key}
            onClick={() => setStatus(c.key)}
            className={[
              'shrink-0 rounded-pill border px-2.5 py-1.5 text-2xs font-semibold transition-colors',
              status === c.key
                ? 'border-transparent bg-accent-subtle text-accent'
                : 'border-border text-fg-muted hover:border-border-strong hover:text-fg',
            ].join(' ')}
          >
            {c.label}
            {c.key === 'needs_human' && needsHumanCount > 0 && (
              <span className="tnum ml-1 text-danger" style={{ fontFamily: 'var(--font-mono)' }}>
                {needsHumanCount}
              </span>
            )}
            {c.key === 'unread' && unreadCount > 0 && (
              <span
                className="tnum ml-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-pill bg-accent px-1 text-[10px] font-bold leading-none text-accent-fg"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  )

  const queue = (
    <div className="flex min-h-0 flex-col bg-surface">
      {filterBar}
      {items.length === 0 ? (
        <div className="p-6">
          {/* §1.9: empty is an invitation, not a mood. */}
          <EmptyState
            icon={InboxIcon}
            title="Nothing waiting."
            body="New WhatsApp and Instagram conversations land here as they arrive."
          />
        </div>
      ) : visibleItems.length === 0 ? (
        <div className="p-6">
          {scope === 'my' && scopedItems.length === 0 ? (
            <EmptyState
              icon={InboxIcon}
              title="No chats labeled to you yet."
              body="Switch to All to pick up new customers, or ask your manager to label chats to you."
            />
          ) : (
            <EmptyState
              icon={Search}
              title="No matches."
              body="Nothing fits these filters. Clear the search or switch to All."
            />
          )}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {visibleItems.map((item) => (
            <QueueRow
              key={item.id}
              item={item}
              snippet={snippets.get(item.id)?.text ?? '—'}
              snippetKind={snippets.get(item.id)?.kind ?? 'text'}
              selected={item.id === selectedId}
              onSelect={() => setSelectedId(item.id)}
              assigneeLabel={scope === 'all' ? labelFor(item.assigned_to) : null}
            />
          ))}
        </div>
      )}
    </div>
  )

  const thread = selectedId && (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-border bg-surface-glass px-4 backdrop-blur-xl">
        {/* Phone: the thread replaces the queue, so it needs a way back. The
            two-pane desktop layout keeps both on screen and hides this. */}
        <button
          onClick={() => setSelectedId(null)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-fg-muted hover:bg-surface-sunk hover:text-fg lg:hidden"
          aria-label="Back to queue"
        >
          <ArrowLeft aria-hidden size={18} />
        </button>
        {/* On the thread the hierarchy flips back and the NAME leads (§1.5). */}
        <div className="min-w-0">
          <span className="block truncate text-md font-semibold tracking-[-0.015em] text-fg">{selectedName}</span>
          {lead?.next_action ? (
            <span className="mt-0.5 flex items-center gap-1 text-2xs font-medium text-accent">
              <span className="h-1.5 w-1.5 rounded-pill bg-signal" /> Next: {lead.next_action}
            </span>
          ) : selected?.bot_paused && !selected?.escalation_resolved ? (
            <span className="mt-0.5 flex items-center gap-1 text-2xs font-medium text-warn">
              <span className="h-1.5 w-1.5 rounded-pill bg-warn" /> Needs human reply
            </span>
          ) : (
            <span className="mt-0.5 flex items-center gap-1 text-2xs font-medium text-fg-subtle">
              <span className="h-1.5 w-1.5 rounded-pill bg-fg-subtle" /> Active conversation
            </span>
          )}
        </div>
        <span className="ml-auto flex shrink-0 items-center gap-2">
          {connectionState === 'reconnecting' && <span className="hidden text-2xs text-warn sm:inline">Reconnecting…</span>}
          {selected && <CallButton person={selectedName} phone={selected.contact?.external_id} variant="icon" contactId={selected.contact_id} conversationId={selectedId} />}
          {/* Rail toggle — sheet below xl, inline pane at xl+. Same button
              drives both so the xl+ pane is always closable (was stuck open,
              button used to vanish exactly at xl via `xl:hidden`). */}
          {selected && clientId && (
            <button
              onClick={() => setRailOpen((v) => !v)}
              aria-label={railOpen ? 'Hide details' : 'Show details'}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-semibold text-fg-muted hover:border-border-strong hover:bg-surface-sunk hover:text-fg sm:px-3"
            >
              {railOpen ? <X aria-hidden size={15} /> : <PanelRight aria-hidden size={15} />}
              <span className="hidden sm:inline">{railOpen ? 'Hide details' : 'Details'}</span>
            </button>
          )}
        </span>
      </div>

      <div className="app-grid min-h-0 flex-1 overflow-y-auto bg-canvas">
        {threadLoading ? (
          <div className="space-y-3 p-4">
            <Skeleton className="h-12 w-2/3" />
            <Skeleton className="ml-auto h-12 w-1/2" />
          </div>
        ) : threadError ? (
          <ErrorState title="Couldn’t open this conversation" body="The queue is still available. Check the connection and try this chat again." onRetry={() => void reloadThread()} />
        ) : !selected && messages.length === 0 ? (
          <EmptyState icon={MessageCircle} title="Conversation unavailable" body="It may have moved outside your current access or been removed. Return to the queue and choose another chat." />
        ) : (
          <Thread messages={displayMessages} traces={traces} media={media} onCopyToComposer={onCopyToComposer} />
        )}
      </div>

      {!threadError && (selected || messages.length > 0) && (
        <Composer
          conversationId={selectedId}
          contactId={selected?.contact_id ?? ''}
          canSend={canSend}
          isOptedOut={selected?.contact?.is_opted_out}
          windowClosed={selected ? isWindowClosed(selected) : false}
          onSent={refreshAll}
          seed={draftSeed}
          onOptimisticSend={onOptimisticSend}
          onOptimisticSettle={onOptimisticSettle}
        />
      )}
    </div>
  )

  const rail = selected && clientId && (
    <ContextRail
      clientId={clientId}
      item={selected}
      onChanged={refreshAll}
      onUseDraft={(text) => {
        setDraftSeed((prev) => ({ n: (prev?.n ?? 0) + 1, text }))
        setRailOpen(false)
      }}
    />
  )

  const activeThread = thread
  const hasSelection = !!selectedId

  return (
    <div className="flex h-full min-h-0 overflow-hidden bg-canvas md:p-3 md:pt-0">
      {/* Below lg: one pane at a time. At lg+: the board sits beside the
          conversation, which is what §1.4's desktop diagram shows. */}
      <div
        className={[
          'min-h-0 w-full flex-col overflow-hidden bg-surface lg:flex lg:w-[380px] lg:shrink-0 lg:border lg:border-border md:rounded-l-xl lg:shadow-elev-1',
          hasSelection ? 'hidden lg:flex' : 'flex',
        ].join(' ')}
      >
        {queue}
      </div>

      <div className={['min-h-0 flex-1 overflow-hidden bg-surface lg:border-y lg:border-r lg:border-border', hasSelection ? 'flex' : 'hidden lg:flex'].join(' ')}>
        <ErrorBoundary resetKey={selectedId}>
          {activeThread ?? (
            <div className="hidden flex-1 items-center justify-center lg:flex">
              <EmptyState
                icon={MessageCircle}
                title="Pick a conversation"
                body="The queue is ordered by most recent message."
              />
            </div>
          )}
        </ErrorBoundary>
      </div>

      {/* SA-05 context rail: its own pane at xl+ … */}
      {rail && railOpen && (
        <div className="hidden w-80 shrink-0 overflow-hidden rounded-r-xl border-y border-r border-border bg-surface shadow-elev-1 xl:block">
          <ErrorBoundary resetKey={selectedId}>{rail}</ErrorBoundary>
        </div>
      )}
      {/* … and a sheet below xl (§1.10 #12: sheets on phone, inline on desktop). */}
      <div className="xl:hidden">
        <Sheet open={railOpen && !!rail} onClose={() => setRailOpen(false)} title={selectedName}>
          <ErrorBoundary resetKey={selectedId}>{rail}</ErrorBoundary>
        </Sheet>
      </div>
    </div>
  )
}
