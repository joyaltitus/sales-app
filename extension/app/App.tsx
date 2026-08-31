import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { MemoryRouter, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { CircleAlert } from 'lucide-react'
import SettingsScreen from './screens/SettingsScreen'
import LibraryScreen from './screens/LibraryScreen'
import { AuthGate } from './AuthGate'
import { useRepQueue, type PanelIdentity } from '../lib/panel-data'
import type { CallOutcome, LeadDetail, QueueItem } from '../lib/contracts'
import { CACHE_KEYS, cacheLeadDetail, cached, readCache } from '../lib/cache'
import { firstOfMonth, useOwnWonValue, useTarget } from '@app/lib/targets-data'
import { useLeadStages, moveLeadStage } from '@app/lib/leads-data'
import { addNote, saveLead } from '@app/lib/crm-actions'
import { completeCall, startCallSession, useCallLogs } from '@app/lib/calls-data'
import { useLeadMemory, useNotes } from '@app/lib/crm-data'
import { logObjection, useObjectionLogs, useObjectionTaxonomy } from '@app/lib/objections-data'
import { chatLink } from '../lib/chat-link'
import { loadChatMode } from './chat-mode'
import { QueueScreen } from '../ui/QueueScreen'
import { LeadScreen } from '../ui/LeadScreen'
import { OutcomeBar } from '../ui/OutcomeBar'
import { TargetBar } from '../ui/TargetBar'
import { VoiceFlow } from '../ui/VoiceFlow'
import { Button } from '../../src/ui/Button'
import { ErrorState } from '../../src/ui/ErrorState'
import { QueueSkeleton, TargetSkeleton } from '../ui/Skeletons'
import { StaleChip } from '../ui/StaleChip'

let rootMounts = 0

export function getRootMounts() {
  return rootMounts
}

const TABS = [
  { to: '/queue', label: 'Queue' },
  { to: '/library', label: 'Library' },
  { to: '/settings', label: 'Settings' },
]
const PANEL_NAV_KEY = 'rep.panelNavigation'
type PanelRoute = '/queue' | '/lead' | '/library' | '/settings'
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

function LeadWorkspace({ identity, lead, stages, taxonomy, onChanged, onRevenueChanged, onBack }: {
  identity: PanelIdentity
  lead: QueueItem
  stages: ReturnType<typeof useLeadStages>['stages']
  taxonomy: ReturnType<typeof useObjectionTaxonomy>['items']
  onChanged: () => void
  onRevenueChanged: () => void
  onBack: () => void
}) {
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

function PanelRoutes({ identity, initialSelected }: { identity: PanelIdentity; initialSelected: QueueItem | null }) {
  const navigate = useNavigate()
  const location = useLocation()
  const queue = useRepQueue(identity)
  const [selected, setSelected] = useState<QueueItem | null>(initialSelected)
  const stages = useLeadStages(identity.clientId)
  const taxonomy = useObjectionTaxonomy(identity.clientId)
  const month = firstOfMonth()
  const target = useTarget(identity.clientId, identity.userId, month)
  const won = useOwnWonValue(identity.clientId, identity.userId, month)

  useEffect(() => {
    void chrome.storage.session.set({
      [PANEL_NAV_KEY]: { route: location.pathname as PanelRoute, selected },
    })
  }, [location.pathname, selected])

  const openLead = (item: QueueItem) => { setSelected(item); navigate('/lead') }
  return (
    <Routes>
      <Route path="/queue" element={queue.loading
        ? <QueueSkeleton />
        : queue.error && queue.items.length === 0
          ? <ErrorState title="Couldn’t load your queue" body="Check your connection, then retry." onRetry={() => void queue.reload()} />
          : <QueueScreen items={queue.items} staleAt={queue.staleAt} refreshError={queue.error} onRetry={() => void queue.reload()} searching={queue.searching} hasMore={queue.hasMore} onSearch={queue.search} onLoadMore={queue.loadMore} target={<OwnTarget identity={identity} target={target} won={won} />} onNext={openLead} onOpenLead={openLead} />}
      />
      <Route path="/lead" element={selected
        ? <LeadWorkspace identity={identity} lead={selected} stages={stages.stages} taxonomy={taxonomy.items} onChanged={() => void queue.reload()} onRevenueChanged={() => void won.reload()} onBack={() => navigate('/queue')} />
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

  useEffect(() => { mainRef.current?.focus() }, [location.pathname])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--canvas)', color: 'var(--fg)' }}>
      <main ref={mainRef} tabIndex={-1} style={{ minHeight: 0, flex: 1, overflowY: 'auto' }}>
        <PanelRoutes identity={identity} initialSelected={initial.selected} />
      </main>
      <nav aria-label="Primary" style={{ display: 'flex', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
        {TABS.map((tab) => (
          <NavLink key={tab.to} to={tab.to}>
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
      const route = saved?.route === '/lead' && !saved.selected ? '/queue' : saved?.route
      setInitial({ route: route ?? '/queue', selected: saved?.selected ?? null })
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
