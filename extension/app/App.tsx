import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { MemoryRouter, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { CircleAlert } from 'lucide-react'
import SettingsScreen from './screens/SettingsScreen'
import LibraryScreen from './screens/LibraryScreen'
import HomeScreen from './screens/HomeScreen'
import { AuthGate } from './AuthGate'
import { useFollowedChat } from './follow-chat'
import { usePlaybookLibrary, useRepQueue, type PanelIdentity } from '../lib/panel-data'
import type { CallOutcome, LeadDetail, QueueItem } from '../lib/contracts'
import { CACHE_KEYS, cacheLeadDetail, cached, readCache } from '../lib/cache'
import { firstOfMonth, useOwnWonValue, useTarget } from '@app/lib/targets-data'
import { useLeadStages } from '@app/lib/leads-data'
import { addNote, createLead } from '@app/lib/crm-actions'
import { completeCall, startCallSession, useCallLogs } from '@app/lib/calls-data'
import { useLeadMemory, useNotes } from '@app/lib/crm-data'
import { useObjectionLogs, useObjectionTaxonomy } from '@app/lib/objections-data'
import { chatLink } from '../lib/chat-link'
import { readChatMessages } from '../lib/wa-bridge'
import type { ChatMessage } from '../lib/wa-chat'
import { loadChatMode } from './chat-mode'
import { queueWrite } from '../lib/outbox-store'
import { CrmScreen, sinceFor, type DateFilterKey } from '../ui/CrmScreen'
import { LeadScreen } from '../ui/LeadScreen'
import { OutcomeTap } from '../ui/OutcomeTap'
import { TargetBar } from '../ui/TargetBar'
import { VoiceFlow } from '../ui/VoiceFlow'
import { FollowingChip } from '../ui/FollowingChip'
import { SaveLeadCard, type SaveLeadDraft } from '../ui/SaveLeadCard'
import { ConversationReview } from '../ui/ConversationReview'
import { CallHud } from '../ui/CallHud'
import { isWideSurface } from '../lib/surface'
import { Button } from '../../src/ui/Button'
import { ErrorState } from '../../src/ui/ErrorState'
import { QueueSkeleton, TargetSkeleton } from '../ui/Skeletons'
import { StaleChip } from '../ui/StaleChip'

let rootMounts = 0

export function getRootMounts() {
  return rootMounts
}

const TABS = [
  { to: '/home', label: 'Home' },
  { to: '/crm', label: 'CRM' },
  { to: '/library', label: 'Library' },
  { to: '/settings', label: 'Settings' },
]
export const PANEL_NAV_KEY = 'rep.panelNavigation'
/** The live call, shared by the two mounts that can show it. See beginCall. */
const CALL_SESSION_KEY = 'rep.callSession'
type PanelRoute = '/home' | '/crm' | '/lead' | '/library' | '/settings'
export type PanelNavigation = { route: PanelRoute; selected: QueueItem | null }

const navLinkStyle = (active: boolean): CSSProperties => ({
  display: 'flex',
  flex: 1,
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 44,
  fontSize: 'var(--text-sm)',
  fontWeight: active ? 650 : 400,
  color: active ? 'var(--accent)' : 'var(--fg-muted)',
  textDecoration: 'none',
})

function OwnTarget({ identity, target, won }: {
  identity: PanelIdentity
  target: ReturnType<typeof useTarget>
  won: ReturnType<typeof useOwnWonValue>
}) {
  const month = firstOfMonth()
  const { item, loading, error, reload } = target
  if (loading || won.loading) return <TargetSkeleton />
  if (error || won.error)
    return (
      <div role="alert" className="flex min-h-10 items-center gap-2 border-b border-border bg-danger-subtle px-3 py-2 text-xs text-danger">
        <CircleAlert aria-hidden size={14} strokeWidth={1.9} className="shrink-0" />
        <span className="min-w-0 flex-1">Your target could not be loaded.</span>
        <Button variant="ghost" size="sm" onClick={() => { void reload(); void won.reload() }}>Retry</Button>
      </div>
    )
  if (!item)
    return <div className="flex min-h-10 items-center border-b border-border px-3 py-2 text-xs text-fg-subtle">No target set for you this month.</div>
  return (
    <TargetBar
      rep_name={identity.displayName}
      month_label={new Date(`${month}T00:00:00`).toLocaleDateString(undefined, { month: 'long' })}
      target_value={item.target_value}
      achieved_value={won.value}
      incentive_per_won={item.incentive_per_won ?? 0}
      bonus_at_target={item.bonus_at_target ?? 0}
    />
  )
}

/**
 * Save the conversation on screen to this lead, as ONE note.
 *
 * `messages` is a table with no INSERT policy for the browser (hub-service owns
 * every row there), and a rep-declared transcript is not a delivered message
 * anyway — so this lands in conversation_notes, the table whose insert policy
 * is exactly "my client, and I am the author".
 */
function SaveConversation({ identity, lead, onSaved }: {
  identity: PanelIdentity
  lead: QueueItem
  onSaved: () => void
}) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function start() {
    setOpen(true)
    setLoading(true)
    setMessage(null)
    setMessages(await readChatMessages())
    setLoading(false)
  }

  async function save(_selected: ChatMessage[], body: string) {
    setBusy(true)
    const result = await addNote(identity.clientId, {
      conversation_id: null,
      lead_id: lead.lead_id,
      author: identity.userId,
      body,
    })
    if (!result.ok) {
      // Offline or denied: queue it rather than losing a transcript the rep
      // already reviewed. The outbox entry id is the idempotency handle.
      const queued = await queueWrite('add_note', {
        client_id: identity.clientId,
        conversation_id: null,
        lead_id: lead.lead_id,
        author: identity.userId,
        body,
      })
      setBusy(false)
      setMessage(queued.ok ? 'Saved offline — it will sync when you’re back.' : 'Couldn’t save. Try again.')
      if (queued.ok) { setOpen(false); onSaved() }
      return
    }
    setBusy(false)
    setOpen(false)
    onSaved()
  }

  if (!open) {
    return (
      <Button variant="secondary" className="min-h-11 w-full" onClick={() => void start()}>
        Save conversation to CRM
      </Button>
    )
  }

  return (
    <ConversationReview
      chatName={lead.display_name}
      messages={messages}
      loading={loading}
      busy={busy}
      message={message}
      onSave={(selected, body) => void save(selected, body)}
      onCancel={() => setOpen(false)}
    />
  )
}

function LeadWorkspace({ identity, lead, onChanged, onRevenueChanged, onBack }: {
  identity: PanelIdentity
  lead: QueueItem
  onChanged: () => void
  onRevenueChanged: () => void
  onBack: () => void
}) {
  // Reference data the LEAD screen needs. Deliberately read here rather than in
  // PanelRoutes: on the old shape both of these fired on panel open, ahead of
  // anything the rep could see.
  const taxonomy = useObjectionTaxonomy(identity.clientId).items
  const library = usePlaybookLibrary(identity.clientId, identity.userId)

  const memory = useLeadMemory(identity.clientId, lead.contact_id, null)
  const objections = useObjectionLogs(identity.clientId, lead.contact_id)
  const calls = useCallLogs(identity.clientId, lead.contact_id)
  const notes = useNotes(identity.clientId, { leadId: lead.lead_id })
  const [current, setCurrent] = useState(lead)
  const [followUp, setFollowUp] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [cachedDetail, setCachedDetail] = useState<LeadDetail | null>(null)
  const [cachedAt, setCachedAt] = useState<string | null>(null)
  // The session id only exists once an outcome has opened one; inserts before
  // that carry null, which is what script_usage expects for a chat-only nudge.
  const [callSessionId, setCallSessionId] = useState<string | null>(null)
  const [ratingOpen, setRatingOpen] = useState(false)
  const callRequestId = useRef(crypto.randomUUID())

  useEffect(() => {
    let alive = true
    setCurrent(lead)
    setCachedDetail(null)
    setCachedAt(null)
    setCallSessionId(null)
    setRatingOpen(false)
    callRequestId.current = crypto.randomUUID()
    // The side panel and the call tab are two React trees over ONE call.
    // Whichever of them dialled owns the session; the other adopts it here —
    // otherwise the tab, which is the surface a rep actually performs from,
    // would sit in chat mode for the whole call and offer them "Insert".
    // ponytail: adopted once, at mount. A dial in the OTHER tree after this one
    // is already open does not reach it; add a storage.onChanged listener if
    // reps start dialling from the tab while the panel is on screen.
    void chrome.storage.session.get(CALL_SESSION_KEY).then((stored) => {
      const open = stored[CALL_SESSION_KEY] as { leadId: string; id: string; requestId: string } | undefined
      if (!alive || open?.leadId !== lead.lead_id) return
      callRequestId.current = open.requestId
      setCallSessionId(open.id)
    })
    void readCache(CACHE_KEYS.leadDetails).then((entries) => {
      const entry = entries?.find((item) => item.scope === identity.clientId && item.data.lead.lead_id === lead.lead_id)
      if (alive && entry) {
        setCachedDetail(entry.data)
        setCachedAt(entry.fetched_at)
      }
    })
    return () => { alive = false }
  }, [identity.clientId, lead])

  /**
   * Open the call session, once per lead.
   *
   * This used to happen inside `outcome()` — that is, when the call was already
   * OVER. Everything keyed on `callSessionId !== null` therefore spent the whole
   * call on the wrong side of the branch: the HUD showed the chat lane's
   * "Insert" to a rep who was talking to a human being, and only switched to
   * the in-call verb once there was nothing left to say. Dialling is the start
   * of a call, so the session starts here and `outcome()` reuses it.
   */
  async function beginCall(): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
    if (callSessionId) return { ok: true, id: callSessionId }
    const started = await startCallSession({
      clientId: identity.clientId,
      contactId: current.contact_id,
      leadId: current.lead_id,
      actorId: identity.userId,
      surface: 'whatsapp_extension',
      requestedNumber: current.phone_e164,
      // Same id for the whole lead: dialling twice is one call session, not two.
      clientRequestId: callRequestId.current,
    })
    if (started.ok) {
      setCallSessionId(started.id)
      void chrome.storage.session.set({
        [CALL_SESSION_KEY]: { leadId: current.lead_id, id: started.id, requestId: callRequestId.current },
      })
    }
    return started
  }

  /** `callbackAtIso` comes from the HUD's Lock callback, which asks for a time;
   *  OutcomeTap still passes nothing and keeps its date-at-09:00 behaviour. */
  async function outcome(value: CallOutcome, taxonomyKey?: string, callbackAtIso?: string): Promise<boolean> {
    if (value === 'objection' && !taxonomyKey) {
      setMessage('Choose an objection type before logging this outcome.')
      return false
    }
    setBusy(true)
    setMessage(null)
    const started = await beginCall()
    const result = started.ok
      ? await completeCall(started.id, value, {
          taxonomyKey: value === 'objection' ? taxonomyKey : null,
          callbackAt: value === 'callback' ? callbackAtIso ?? (followUp ? `${followUp}T09:00:00.000Z` : null) : null,
        })
      : started
    setBusy(false)
    if (!result.ok) {
      setMessage(result.message)
      return false
    }
    setMessage('Outcome logged.')
    setRatingOpen(true)
    if (value === 'closed') onRevenueChanged()
    void calls.reload()
    if (value === 'objection') void objections.reload()
    onChanged()
    return true
  }

  const detail: LeadDetail = useMemo(() => {
    const facts = memory.facts.map((fact) => ({
      id: fact.id,
      kind: fact.category,
      fact_key: fact.label,
      value: fact.value,
      status: fact.state === 'suggested' ? 'suggested' as const : 'confirmed' as const,
      confidence: fact.confidence,
    }))
    const objectionRows = objections.items.map((item) => ({
      id: item.id,
      taxonomy_key: item.taxonomyKey,
      label: item.taxonomyLabel,
      occurred_at: item.occurred_at,
      note: item.note,
      resolved_at: item.resolved ? item.occurred_at : null,
    }))
    const timeline = [
      ...calls.items.map((item) => ({ kind: 'call_log' as const, at: item.occurred_at, outcome: item.outcome, note: item.note, source: 'rep' as const })),
      ...notes.items.map((item) => ({ kind: 'note' as const, at: item.created_at, body: item.body, author: item.author ? { user_id: item.author, display_name: item.author === identity.userId ? identity.displayName : null } : null, source: 'rep' as const })),
      ...objections.items.map((item) => ({ kind: 'objection' as const, at: item.occurred_at, taxonomy_key: item.taxonomyKey, label: item.taxonomyLabel, source: item.source === 'chat' ? 'api' as const : 'rep' as const })),
    ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    return {
      lead: current,
      facts,
      objections: objectionRows,
      timeline,
      source: facts.length > 0 && timeline.length > 0 ? 'both' : facts.length > 0 ? 'api' : 'rep',
    }
  }, [calls.items, current, identity.displayName, identity.userId, memory.facts, notes.items, objections.items])
  const detailPending = memory.loading || objections.loading || calls.loading || notes.loading
  const detailError = memory.error || objections.error || calls.error || notes.error
  const visibleDetail = cachedDetail && (detailPending || detailError) ? { ...cachedDetail, lead: current } : detail

  useEffect(() => {
    if (detailPending || detailError) return
    setCachedDetail(null)
    setCachedAt(null)
    void cacheLeadDetail(cached(detail, new Date(), identity.clientId))
  }, [detail, detailError, detailPending, identity.clientId])
  const taxonomyOptions = taxonomy.map((item) => ({ key: item.key, label: item.label }))
  // One chip for the whole workspace: the lead's own history if that is what is
  // stale, otherwise the playbook the HUD is reading from.
  const staleAt = (cachedAt && (detailPending || detailError)) ? cachedAt : library.staleAt

  return (
    <LeadScreen
      detail={visibleDetail}
      viewerId={identity.userId}
      onBack={onBack}
      pending={detailPending && !cachedDetail}
      workspace={(
        <div className="space-y-3 px-3 pt-3">
          {staleAt && (
            <div className="flex min-h-8 items-center"><StaleChip fetched_at={staleAt} /></div>
          )}
          {detailError && (
            <p role="alert" className="flex items-start gap-2 rounded-md bg-danger-subtle px-3 py-2 text-xs leading-relaxed text-danger">
              <CircleAlert aria-hidden size={14} strokeWidth={1.9} className="mt-0.5 shrink-0" />
              Some lead history could not be loaded. Retry by reopening this lead.
            </p>
          )}
          {/* Confirmation of the primary action sits above the controls, not
              below them — after a tap the rep must not have to scroll to learn
              whether the tap landed. */}
          {message && (
            <p role="status" className="rounded-md border border-border bg-surface-sunk px-3 py-2 text-xs text-fg-muted">{message}</p>
          )}
          <CallHud
            identity={identity}
            lead={current}
            library={library}
            calls={calls.items}
            callSessionId={callSessionId}
            ratingOpen={ratingOpen}
            busy={busy}
            onResult={setMessage}
            onLockCallback={(atIso) => outcome('callback', undefined, atIso)}
          />
          <SaveConversation identity={identity} lead={current} onSaved={() => { void notes.reload(); onChanged() }} />
          <VoiceFlow clientId={identity.clientId} leadId={current.lead_id} onSaved={onChanged} />
          <section className="rounded-lg border border-border bg-surface-raised shadow-elev-1">
            <OutcomeTap
              taxonomy={taxonomyOptions}
              busy={busy}
              onOutcome={(value, key) => void outcome(value, key)}
              onFollowUpChange={setFollowUp}
            />
          </section>
        </div>
      )}
      onOpenChat={() => {
        void loadChatMode().then((mode) => {
          const url = chatLink(current.phone_e164, mode)
          if (url) void chrome.runtime.sendMessage({ type: 'rep.openChat', url, mode })
        })
      }}
      onCall={() => {
        if (!current.phone_e164) return
        void beginCall()
        void chrome.tabs.create({ url: `tel:${current.phone_e164}` })
      }}
    />
  )
}

/**
 * Create a lead through create_manual_lead, with the offline queue behind it.
 *
 * Shared by the Save-as-lead card (an unmatched chat) and the CRM's Add form,
 * so the provenance note and the source decision are written once.
 */
function useCreateLead(identity: PanelIdentity, onSaved: () => void) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function save(draft: SaveLeadDraft, fromChat: boolean): Promise<boolean> {
    setBusy(true)
    setMessage(null)
    // The rep's own note, and provenance, ride in the note create_manual_lead
    // writes for us. Provenance cannot go in leads.source: the agent RLS
    // branch that lets a rep create AND later edit their own lead is gated on
    // source = 'manual' (leads_agent_insert / leads_agent_update), so another
    // value is denied on the way in and would strip the rep's update rights on
    // the way out. Both migrations are proposed in the PR.
    const note = [
      draft.note || null,
      fromChat ? 'Saved from a WhatsApp Web chat by the rep.' : 'Added by the rep from the CRM.',
    ].filter(Boolean).join(' · ')
    const args = {
      client_id: identity.clientId,
      profile_name: draft.name,
      phone: draft.phone,
      channel: draft.channel,
      stage_id: draft.stageId,
      est_value: draft.estValue,
      next_action: draft.nextAction || null,
      note,
    }
    const result = await createLead(identity.clientId, {
      profileName: draft.name,
      phone: draft.phone,
      channel: draft.channel,
      stageId: draft.stageId,
      estValue: draft.estValue,
      nextAction: draft.nextAction || null,
      note,
    })
    if (!result.ok) {
      const queued = await queueWrite('create_lead', args)
      setBusy(false)
      setMessage(queued.ok ? 'Saved offline — it will sync when you’re back.' : 'Couldn’t save. Try again.')
      if (queued.ok) onSaved()
      return queued.ok
    }
    setBusy(false)
    onSaved()
    return true
  }

  return { busy, message, save }
}

/** The Save-as-lead card, shown when the followed chat matched nothing. */
function UnmatchedChat({ identity, follow, onSaved }: {
  identity: PanelIdentity
  follow: ReturnType<typeof useFollowedChat>
  onSaved: () => void
}) {
  const stages = useLeadStages(identity.clientId)
  const [dismissed, setDismissed] = useState<string | null>(null)
  const chat = follow.chat
  const { busy, message, save } = useCreateLead(identity, onSaved)

  if (!chat || follow.match.lead || dismissed === chat.displayName) return null
  return (
    <div className="p-3">
      <SaveLeadCard
        chat={chat}
        stages={stages.stages.map((stage) => ({ id: stage.id, label: stage.label }))}
        stagesLoading={stages.loading}
        busy={busy}
        message={message}
        onSave={(draft) => void save(draft, true)}
        onDismiss={() => setDismissed(chat.displayName)}
      />
    </div>
  )
}

/** The CRM's Add-lead form: the same card, with no chat behind it. */
function AddLead({ identity, query, openChat, onDone, onCancel }: {
  identity: PanelIdentity
  query: string
  openChat: ReturnType<typeof useFollowedChat>['chat']
  onDone: () => void
  onCancel: () => void
}) {
  const stages = useLeadStages(identity.clientId)
  const { busy, message, save } = useCreateLead(identity, onDone)

  return (
    <div className="p-3">
      <SaveLeadCard
        chat={null}
        initialQuery={query}
        openChat={openChat}
        title="New lead"
        hint="Number, source and stage are required. The rest helps later."
        stages={stages.stages.map((stage) => ({ id: stage.id, label: stage.label }))}
        stagesLoading={stages.loading}
        busy={busy}
        message={message}
        onSave={(draft) => void save(draft, false)}
        onDismiss={onCancel}
      />
    </div>
  )
}

function PanelRoutes({ identity, initialSelected, follow }: {
  identity: PanelIdentity
  initialSelected: QueueItem | null
  follow: ReturnType<typeof useFollowedChat>
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const [dateFilter, setDateFilter] = useState<DateFilterKey>('any')
  const [crmQuery, setCrmQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const since = useMemo(() => sinceFor(dateFilter), [dateFilter])
  const queue = useRepQueue(identity, since)
  const [selected, setSelected] = useState<QueueItem | null>(initialSelected)
  const month = firstOfMonth()
  const target = useTarget(identity.clientId, identity.userId, month)
  const won = useOwnWonValue(identity.clientId, identity.userId, month)
  const followedLead = follow.match.lead

  // The panel is the WRITER of shared nav; the call tab is a reader only. Two
  // writers would ping-pong the selection between mounts on every render.
  useEffect(() => {
    if (isWideSurface()) return
    void chrome.storage.session.set({
      [PANEL_NAV_KEY]: { route: location.pathname as PanelRoute, selected },
    })
  }, [location.pathname, selected])

  // ...and the call tab follows it live. Not a query param and not a reload:
  // the rep is mid-call, and a page reload would drop the roadmap step, the
  // picked objection and the composed close they were halfway through.
  useEffect(() => {
    if (!isWideSurface()) return
    const onChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area !== 'session' || !changes[PANEL_NAV_KEY]) return
      const next = changes[PANEL_NAV_KEY].newValue as PanelNavigation | undefined
      if (!next?.selected) return
      setSelected((current) => (current?.lead_id === next.selected?.lead_id ? current : next.selected))
      if (next.route === '/lead') navigate('/lead')
    }
    chrome.storage.onChanged.addListener(onChanged)
    return () => chrome.storage.onChanged.removeListener(onChanged)
  }, [navigate])

  const openLead = useCallback((item: QueueItem) => { setSelected(item); navigate('/lead') }, [navigate])

  // Following a chat MOVES the panel to that lead. Deliberately keyed on the
  // lead id, so re-opening the same chat after the rep navigated away does not
  // yank them back off the screen they chose.
  const followedId = followedLead?.lead_id ?? null
  useEffect(() => {
    if (!followedId) return
    const item = queue.items.find((candidate) => candidate.lead_id === followedId)
    if (item) openLead(item)
  }, [followedId, openLead, queue.items])

  return (
    <Routes>
      <Route path="/home" element={(
        <>
          <UnmatchedChat identity={identity} follow={follow} onSaved={() => void queue.reload()} />
          <HomeScreen
            items={queue.items}
            loading={queue.loading}
            error={queue.error}
            staleAt={queue.staleAt}
            target={<OwnTarget identity={identity} target={target} won={won} />}
            onRetry={() => void queue.reload()}
            onOpenLead={openLead}
            onSeeQueue={() => navigate('/crm')}
          />
        </>
      )} />
      <Route path="/crm" element={adding
        ? <AddLead
            identity={identity}
            query={crmQuery}
            openChat={follow.chat}
            onDone={() => { setAdding(false); void queue.reload() }}
            onCancel={() => setAdding(false)}
          />
        : queue.loading
          ? <QueueSkeleton />
          : queue.error && queue.items.length === 0
            ? <ErrorState title="Couldn’t load your leads" body="Check your connection, then retry." onRetry={() => void queue.reload()} />
            : <CrmScreen
                items={queue.items}
                staleAt={queue.staleAt}
                refreshError={queue.error}
                onRetry={() => void queue.reload()}
                searching={queue.searching}
                hasMore={queue.hasMore}
                dateFilter={dateFilter}
                onDateFilter={setDateFilter}
                onSearch={(next) => { setCrmQuery(next); queue.search(next) }}
                onLoadMore={queue.loadMore}
                onAddLead={() => setAdding(true)}
                onOpenLead={openLead}
              />}
      />
      <Route path="/lead" element={selected
        ? <LeadWorkspace identity={identity} lead={selected} onChanged={() => void queue.reload()} onRevenueChanged={() => void won.reload()} onBack={() => navigate('/home')} />
        : <QueueSkeleton />}
      />
      <Route path="/library" element={<LibraryScreen identity={identity} />} />
      <Route path="/settings" element={<SettingsScreen clientId={identity.clientId} />} />
    </Routes>
  )
}

function PanelLayout({ identity, initial }: { identity: PanelIdentity; initial: PanelNavigation }) {
  const location = useLocation()
  const mainRef = useRef<HTMLElement>(null)
  const queue = useRepQueue(identity)
  const follow = useFollowedChat(queue.items)

  useEffect(() => { mainRef.current?.focus() }, [location.pathname])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--canvas)', color: 'var(--fg)' }}>
      <FollowingChip
        enabled={follow.enabled}
        chatName={follow.chat?.displayName ?? null}
        onToggle={follow.setEnabled}
      />
      <main ref={mainRef} tabIndex={-1} style={{ minHeight: 0, flex: 1, overflowY: 'auto' }}>
        <PanelRoutes identity={identity} initialSelected={initial.selected} follow={follow} />
      </main>
      <nav aria-label="Primary" style={{ display: 'flex', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
        {TABS.map((tab) => (
          <NavLink key={tab.to} to={tab.to} style={{ flex: 1, textDecoration: 'none' }}>
            {({ isActive }) => (
              <span style={{ ...navLinkStyle(isActive), width: '100%' }}>{tab.label}</span>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

export function AppShell({ identity }: { identity: PanelIdentity }) {
  const [initial, setInitial] = useState<PanelNavigation | null>(null)
  useEffect(() => {
    rootMounts += 1
    void chrome.storage.session.get(PANEL_NAV_KEY).then((stored) => {
      const saved = stored[PANEL_NAV_KEY] as PanelNavigation | undefined
      const route = saved?.route === '/lead' && !saved.selected ? '/home' : saved?.route
      setInitial({ route: route ?? '/home', selected: saved?.selected ?? null })
    })
  }, [])

  if (!initial) return <QueueSkeleton />

  return (
    <MemoryRouter initialEntries={[initial.route]}>
      <PanelLayout identity={identity} initial={initial} />
    </MemoryRouter>
  )
}

export default function App() {
  return <AuthGate>{(identity) => <AppShell identity={identity} />}</AuthGate>
}
