import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, Inbox as InboxIcon, MessageCircle, ArrowLeft, PanelRight, Radio } from 'lucide-react'
import { useClient } from '../../shell/ClientProvider'
import { useAuth } from '../../auth/AuthProvider'
import { useQueue, usePreviews, useThread, useLiveRefresh } from '../../lib/inbox-data'
import type { QueueItem } from '../../lib/inbox-data'
import { useTeammates, teammateLabel } from '../../lib/crm-data'
import { EmptyState } from '../../ui/EmptyState'
import { Skeleton } from '../../ui/Skeleton'
import { QueueRow } from './QueueRow'
import { Thread } from './Thread'
import { Composer } from './Composer'
import { ContextRail } from './ContextRail'
import { Sheet } from '../../ui/Sheet'
import { EmailQueueRow } from '../email/EmailQueueRow'
import { CallButton } from '../calls/CallButton'

const EmailConversation = lazy(() => import('../email/EmailConversation'))

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
type ChannelFilter = '' | 'whatsapp' | 'instagram' | 'email'

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
  { key: 'email', label: 'Email' },
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
  const [emailOpen, setEmailOpen] = useState(false)

  // Channel tab is URL-backed (§S6 item 2, same param Workbench uses) so a
  // filtered view survives refresh and can be linked. Status + search stay
  // local — they are working state, not an address.
  const rawChannel = searchParams.get('channel')
  const channel: ChannelFilter =
    rawChannel === 'whatsapp' || rawChannel === 'instagram' || rawChannel === 'email' ? rawChannel : ''
  const setChannel = (next: ChannelFilter) => {
    const params = new URLSearchParams(searchParams)
    if (next) params.set('channel', next)
    else params.delete('channel')
    setSearchParams(params, { replace: true })
  }
  const [status, setStatus] = useState<StatusFilter>('open')
  const [query, setQuery] = useState('')

  // SA-06 "My inbox": chats labeled to me (`conversations.assigned_to`).
  // Reps land on My (Joyal's spec — the employee opens to their own chats,
  // with All one tap away); desktop roles land on All. Rendering scope only.
  const [scope, setScope] = useState<'my' | 'all'>(role === 'agent' ? 'my' : 'all')
  const { items: teammates } = useTeammates(clientId)
  const labelFor = useCallback(
    (assignedTo: string | null): string | null => {
      if (!assignedTo) return null
      if (assignedTo === userId) return 'You'
      const t = teammates.find((x) => x.user_id === assignedTo)
      return t ? teammateLabel(t) : 'Teammate'
    },
    [userId, teammates],
  )

  // SA-05 context rail: its own pane at xl+, a sheet below that. The AI draft
  // seeds the composer through this counter-keyed value (a bare string could
  // not be "used twice").
  const [railOpen, setRailOpen] = useState(false)
  const [draftSeed, setDraftSeed] = useState<{ n: number; text: string } | null>(null)

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

  const { channelLive } = useLiveRefresh(clientId, refreshAll)

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
        ? channel === 'email' ? [] : scopedItems.filter((i) => (i.contact?.channel ?? 'whatsapp') === channel)
        : scopedItems,
    [scopedItems, channel],
  )
  const needsHumanCount = useMemo(
    () => channelItems.filter((i) => matchesStatus(i, 'needs_human')).length,
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
  const emailVisible = useMemo(() => {
    if (channel && channel !== 'email') return false
    if (status === 'closed' || status === 'needs_human') return false
    const q = query.trim().toLowerCase()
    return !q || 'kavya menon corporate wellness proposal mumbai clinic'.includes(q)
  }, [channel, status, query])

  // Selection is looked up in the UNFILTERED list on purpose: a landing can
  // deep-link a closed conversation while the queue shows Open — the thread
  // must still render even though its row is filtered out.
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

  const filterBar = (
    <div className="shrink-0 space-y-3 border-b border-border bg-surface px-4 pt-4 pb-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold tracking-[-0.025em] text-fg">Inbox</h1>
            {channelLive && <span className="flex items-center gap-1 text-2xs font-semibold text-success"><Radio aria-hidden size={11} /> Live</span>}
          </div>
          <p className="mt-0.5 text-2xs text-fg-muted">{visibleItems.length + (emailVisible ? 1 : 0)} conversations in view</p>
        </div>
        {needsHumanCount > 0 && <span className="tnum rounded-pill bg-danger-subtle px-2 py-1 text-2xs font-semibold text-danger">{needsHumanCount} need you</span>}
      </div>
      {/* Scope + channel controls. */}
      <div className="flex items-center gap-2 overflow-x-auto">
        <div
          role="tablist"
          aria-label="Inbox scope"
          className="flex shrink-0 rounded-md border border-border bg-surface-sunk p-0.5"
        >
          {(
            [
              ['my', 'My inbox'],
              ['all', 'All'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={scope === key}
              onClick={() => setScope(key)}
              className={[
                'rounded-sm px-2.5 py-1.5 text-xs font-medium transition-colors',
                scope === key ? 'bg-surface-raised text-fg shadow-elev-1' : 'text-fg-muted hover:text-fg',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>
        <div
          role="tablist"
          aria-label="Channel"
          className="flex shrink-0 rounded-md border border-border bg-surface-sunk p-0.5"
        >
          {CHANNEL_TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={channel === t.key}
              onClick={() => setChannel(t.key)}
              className={[
                'rounded-sm px-2.5 py-1.5 text-xs font-medium transition-colors',
                channel === t.key
                  ? 'bg-surface-raised text-fg shadow-elev-1'
                  : 'text-fg-muted hover:text-fg',
              ].join(' ')}
            >
              {t.label}
            </button>
          ))}
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
      <div className="flex gap-1.5 overflow-x-auto" role="group" aria-label="Status filter">
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
          </button>
        ))}
      </div>
    </div>
  )

  const queue = (
    <div className="flex min-h-0 flex-col bg-surface">
      {filterBar}
      {items.length === 0 && !emailVisible ? (
        <div className="p-6">
          {/* §1.9: empty is an invitation, not a mood. */}
          <EmptyState
            icon={InboxIcon}
            title="Nothing waiting."
            body="New WhatsApp, Instagram and email conversations land here as they arrive."
          />
        </div>
      ) : visibleItems.length === 0 && !emailVisible ? (
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
          {emailVisible && <EmailQueueRow selected={emailOpen} onSelect={() => { setSelectedId(null); setEmailOpen(true) }} />}
          {visibleItems.map((item) => (
            <QueueRow
              key={item.id}
              item={item}
              preview={previews.get(item.id) ?? item.contact?.profile_name ?? '—'}
              selected={item.id === selectedId}
              onSelect={() => { setEmailOpen(false); setSelectedId(item.id) }}
              assigneeLabel={scope === 'all' ? labelFor(item.assigned_to) : null}
            />
          ))}
        </div>
      )}
    </div>
  )

  const thread = selected && (
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
          <span className="mt-0.5 flex items-center gap-1 text-2xs font-medium text-accent"><span className="h-1.5 w-1.5 rounded-pill bg-signal" /> Next: answer the price question</span>
        </div>
        <span className="ml-auto flex shrink-0 items-center gap-2">
          {!channelLive && (
            <span className="text-2xs text-fg-subtle">Checking for updates</span>
          )}
          <CallButton person={selectedName} phone={selected.contact?.external_id} dealValue={60000} variant="icon" />
          {/* Rail toggle — the third pane below xl, where it renders as a sheet. */}
          <button
            onClick={() => setRailOpen(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-semibold text-fg-muted hover:border-border-strong hover:bg-surface-sunk hover:text-fg xl:hidden"
          >
            <PanelRight aria-hidden size={15} /> Details
          </button>
        </span>
      </div>

      <div className="app-grid min-h-0 flex-1 overflow-y-auto bg-canvas">
        {threadLoading ? (
          <div className="space-y-3 p-4">
            <Skeleton className="h-12 w-2/3" />
            <Skeleton className="ml-auto h-12 w-1/2" />
          </div>
        ) : (
          <Thread messages={messages} traces={traces} />
        )}
      </div>

      <Composer
        conversationId={selected.id}
        canSend={canSend}
        onSent={refreshAll}
        seed={draftSeed}
      />
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

  const emailThread = emailOpen && <Suspense fallback={<div className="flex flex-1 flex-col gap-3 p-4"><Skeleton className="h-20" /><Skeleton className="h-48" /><Skeleton className="h-40" /></div>}><EmailConversation canSend={canSend} onBack={() => setEmailOpen(false)} /></Suspense>
  const activeThread = emailThread ?? thread
  const hasSelection = emailOpen || !!selectedId

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
        {activeThread ?? (
          <div className="hidden flex-1 items-center justify-center lg:flex">
            <EmptyState
              icon={MessageCircle}
              title="Pick a conversation"
              body="The queue is ordered by who has waited longest."
            />
          </div>
        )}
      </div>

      {/* SA-05 context rail: its own pane at xl+ … */}
      {rail && (
        <div className="hidden w-80 shrink-0 overflow-hidden rounded-r-xl border-y border-r border-border bg-surface shadow-elev-1 xl:block">
          {rail}
        </div>
      )}
      {/* … and a sheet below xl (§1.10 #12: sheets on phone, inline on desktop). */}
      <div className="xl:hidden">
        <Sheet open={railOpen && !!rail} onClose={() => setRailOpen(false)} title={selectedName}>
          {rail}
        </Sheet>
      </div>
    </div>
  )
}
