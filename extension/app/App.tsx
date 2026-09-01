import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { MemoryRouter, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { CircleAlert } from 'lucide-react'
import SettingsScreen from './screens/SettingsScreen'
import LibraryScreen from './screens/LibraryScreen'
import HomeScreen from './screens/HomeScreen'
import { AuthGate } from './AuthGate'
import { useFollowedChat } from './follow-chat'
import { useCachedScriptLibrary, useRepQueue, type PanelIdentity } from '../lib/panel-data'
import type { CallOutcome, LeadDetail, QueueItem, Snippet } from '../lib/contracts'
import { CACHE_KEYS, cacheLeadDetail, cached, readCache } from '../lib/cache'
import { firstOfMonth, useOwnWonValue, useTarget } from '@app/lib/targets-data'
import { useLeadStages, moveLeadStage } from '@app/lib/leads-data'
import { addNote, createLead, saveLead } from '@app/lib/crm-actions'
import { completeCall, startCallSession, useCallLogs } from '@app/lib/calls-data'
import { useLeadMemory, useNotes } from '@app/lib/crm-data'
import { logObjection, useObjectionLogs, useObjectionTaxonomy } from '@app/lib/objections-data'
import { chatLink } from '../lib/chat-link'
import { readChatMessages } from '../lib/wa-bridge'
import type { ChatMessage } from '../lib/wa-chat'
import { loadChatMode } from './chat-mode'
import { queueWrite } from '../lib/outbox-store'
import { QueueScreen } from '../ui/QueueScreen'
import { LeadScreen } from '../ui/LeadScreen'
import { OutcomeBar } from '../ui/OutcomeBar'
import { TargetBar } from '../ui/TargetBar'
import { VoiceFlow } from '../ui/VoiceFlow'
import { FollowingChip } from '../ui/FollowingChip'
import { SaveLeadCard, type SaveLeadDraft } from '../ui/SaveLeadCard'
import { ConversationReview } from '../ui/ConversationReview'
import { SnippetBar } from '../ui/SnippetBar'
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
  { to: '/queue', label: 'Queue' },
  { to: '/library', label: 'Library' },
  { to: '/settings', label: 'Settings' },
]
const PANEL_NAV_KEY = 'rep.panelNavigation'
type PanelRoute = '/home' | '/queue' | '/lead' | '/library' | '/settings'
type PanelNavigation = { route: PanelRoute; selected: QueueItem | null }

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
  const stages = useLeadStages(identity.clientId).stages
  const taxonomy = useObjectionTaxonomy(identity.clientId).items
  const library = useCachedScriptLibrary(identity.clientId)

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
  const callRequestId = useRef(crypto.randomUUID())

  useEffect(() => {
    let alive = true
    setCurrent(lead)
    setCachedDetail(null)
    setCachedAt(null)
    callRequestId.current = crypto.randomUUID()
    void readCache(CACHE_KEYS.leadDetails).then((entries) => {
      const entry = entries?.find((item) => item.scope === identity.clientId && item.data.lead.lead_id === lead.lead_id)
      if (alive && entry) {
        setCachedDetail(entry.data)
        setCachedAt(entry.fetched_at)
      }
    })
    return () => { alive = false }
  }, [identity.clientId, lead])

  async function outcome(value: CallOutcome, taxonomyKey?: string) {
    if (value === 'objection' && !taxonomyKey) {
      setMessage('Choose an objection type before logging this outcome.')
      return
    }
    setBusy(true)
    setMessage(null)
    const started = await startCallSession({
      clientId: identity.clientId,
      contactId: current.contact_id,
      leadId: current.lead_id,
      actorId: identity.userId,
      surface: 'whatsapp_extension',
      requestedNumber: current.phone_e164,
      clientRequestId: callRequestId.current,
    })
    const result = started.ok
      ? await completeCall(started.id, value, {
          taxonomyKey: value === 'objection' ? taxonomyKey : null,
          callbackAt: value === 'callback' && followUp ? `${followUp}T09:00:00.000Z` : null,
        })
      : started
    setBusy(false)
    if (!result.ok) setMessage(result.message)
    else {
      setMessage('Outcome logged.')
      void calls.reload()
      if (value === 'objection') void objections.reload()
      onChanged()
    }
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
  const stageOptions = stages.map((stage) => ({ key: stage.stage_key, label: stage.label }))
  const taxonomyOptions = taxonomy.map((item) => ({ key: item.key, label: item.label }))
  const snippets: Snippet[] = library.scripts.map((script) => ({
    id: script.taxonomyId,
    title: script.taxonomyLabel,
    body: script.current?.body?.paragraphs
      .map((paragraph) => `${paragraph.before}${paragraph.highlight ?? ''}${paragraph.after ?? ''}`)
      .join('\n\n') ?? '',
    scope: 'shared' as const,
  })).filter((snippet) => snippet.body)

  return (
    <LeadScreen
      detail={visibleDetail}
      viewerId={identity.userId}
      onBack={onBack}
      pending={detailPending && !cachedDetail}
      workspace={(
        <div className="space-y-3 px-3 pt-3">
          {cachedAt && (detailPending || detailError) && (
            <div className="flex min-h-8 items-center"><StaleChip fetched_at={cachedAt} /></div>
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
          <SnippetBar
            scripts={snippets}
            vars={{ name: current.display_name, rep: identity.displayName }}
            onResult={setMessage}
          />
          <SaveConversation identity={identity} lead={current} onSaved={() => { void notes.reload(); onChanged() }} />
          <VoiceFlow clientId={identity.clientId} leadId={current.lead_id} onSaved={onChanged} />
          <section className="rounded-lg border border-border bg-surface-raised shadow-elev-1">
            <OutcomeBar
              stages={stageOptions}
              stageKey={current.stage_key}
              status={current.status}
              taxonomy={taxonomyOptions}
              busy={busy}
              onOutcome={(value, key) => void outcome(value, key)}
              onStageChange={(key) => {
                const stage = stages.find((item) => item.stage_key === key)
                if (!stage) return
                setBusy(true)
                void moveLeadStage(identity.clientId, current.lead_id, stage.id).then((result) => {
                  setBusy(false)
                  if (!result.ok) setMessage(result.message ?? 'Stage change was denied.')
                  else { setCurrent((item) => ({ ...item, stage_key: key, stage_label: stage.label })); onChanged() }
                })
              }}
              onStatusChange={(status) => {
                const stage = stages.find((item) => item.stage_key === current.stage_key)
                if (!stage) return
                setBusy(true)
                void saveLead(identity.clientId, current.lead_id, stage.id, { status }).then((result) => {
                  setBusy(false)
                  if (!result.ok) setMessage(result.message ?? 'Status change was denied.')
                  else {
                    setCurrent((item) => ({ ...item, status }))
                    onChanged()
                    if (status === 'won') onRevenueChanged()
                  }
                })
              }}
              onFollowUpChange={setFollowUp}
              onSaveNote={(body) => {
                setBusy(true)
                void addNote(identity.clientId, { conversation_id: null, lead_id: current.lead_id, author: identity.userId, body }).then((result) => {
                  setBusy(false)
                  setMessage(result.ok ? 'Note saved.' : result.message ?? 'Note could not be saved.')
                  if (result.ok) { void notes.reload(); onChanged() }
                })
              }}
              onObjection={(key) => {
                const item = taxonomy.find((candidate) => candidate.key === key)
                if (!item) return
                setBusy(true)
                void logObjection({ clientId: identity.clientId, contactId: current.contact_id, leadId: current.lead_id, taxonomyId: item.id, source: 'crm', actorId: identity.userId }).then((result) => {
                  setBusy(false)
                  setMessage(result.ok ? 'Objection logged.' : result.message)
                  if (result.ok) { void objections.reload(); onChanged() }
                })
              }}
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
      onCall={() => { if (current.phone_e164) void chrome.tabs.create({ url: `tel:${current.phone_e164}` }) }}
    />
  )
}

/** The Save-as-lead card, shown when the followed chat matched nothing. */
function UnmatchedChat({ identity, follow, onSaved }: {
  identity: PanelIdentity
  follow: ReturnType<typeof useFollowedChat>
  onSaved: () => void
}) {
  const stages = useLeadStages(identity.clientId)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState<string | null>(null)
  const chat = follow.chat

  if (!chat || follow.match.lead || dismissed === chat.displayName) return null

  async function save(draft: SaveLeadDraft) {
    setBusy(true)
    setMessage(null)
    // Provenance rides in the note create_manual_lead writes for us. It cannot
    // ride in leads.source: the agent RLS branch that lets a rep create AND
    // later edit their own lead is gated on source = 'manual' (leads_agent_insert
    // / leads_agent_update), so a different value is denied on the way in and
    // would strip the rep's own update rights on the way out. Migration proposed
    // in the PR.
    const note = [
      draft.interest ? `Interest: ${draft.interest}` : null,
      'Saved from a WhatsApp Web chat by the rep.',
    ].filter(Boolean).join(' · ')
    const args = {
      client_id: identity.clientId,
      profile_name: draft.name,
      phone: draft.phone,
      channel: 'whatsapp',
      stage_id: draft.stageId,
      note,
    }
    const result = await createLead(identity.clientId, {
      profileName: draft.name,
      phone: draft.phone,
      channel: 'whatsapp',
      stageId: draft.stageId,
      note,
    })
    if (!result.ok) {
      const queued = await queueWrite('create_lead', args)
      setBusy(false)
      setMessage(queued.ok ? 'Saved offline — it will sync when you’re back.' : 'Couldn’t save. Try again.')
      if (queued.ok) setDismissed(draft.name)
      return
    }
    setBusy(false)
    onSaved()
  }

  return (
    <div className="p-3">
      <SaveLeadCard
        chat={chat}
        stages={stages.stages.map((stage) => ({ id: stage.id, label: stage.label }))}
        stagesLoading={stages.loading}
        busy={busy}
        message={message}
        onSave={(draft) => void save(draft)}
        onDismiss={() => setDismissed(chat.displayName)}
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
  const queue = useRepQueue(identity)
  const [selected, setSelected] = useState<QueueItem | null>(initialSelected)
  const month = firstOfMonth()
  const target = useTarget(identity.clientId, identity.userId, month)
  const won = useOwnWonValue(identity.clientId, identity.userId, month)
  const followedLead = follow.match.lead

  useEffect(() => {
    void chrome.storage.session.set({
      [PANEL_NAV_KEY]: { route: location.pathname as PanelRoute, selected },
    })
  }, [location.pathname, selected])

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
            onSeeQueue={() => navigate('/queue')}
          />
        </>
      )} />
      <Route path="/queue" element={queue.loading
        ? <QueueSkeleton />
        : queue.error && queue.items.length === 0
          ? <ErrorState title="Couldn’t load your queue" body="Check your connection, then retry." onRetry={() => void queue.reload()} />
          : <QueueScreen items={queue.items} staleAt={queue.staleAt} refreshError={queue.error} onRetry={() => void queue.reload()} searching={queue.searching} hasMore={queue.hasMore} onSearch={queue.search} onLoadMore={queue.loadMore} onNext={openLead} onOpenLead={openLead} />}
      />
      <Route path="/lead" element={selected
        ? <LeadWorkspace identity={identity} lead={selected} onChanged={() => void queue.reload()} onRevenueChanged={() => void won.reload()} onBack={() => navigate('/home')} />
        : <QueueSkeleton />}
      />
      <Route path="/library" element={<LibraryScreen clientId={identity.clientId} />} />
      <Route path="/settings" element={<SettingsScreen />} />
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
