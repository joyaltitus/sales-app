import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { MemoryRouter, NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import { CircleAlert } from 'lucide-react'
import SettingsScreen from './screens/SettingsScreen'
import { drainOutbox } from '../lib/outbox-store'
import { checkPanelSession } from '../lib/session'
import { panelSupabase } from '../lib/panel-client'
import { AUTH_NEEDS_SIGNIN_KEY } from '../lib/storage'
import { loadPanelIdentity, useCachedScriptLibrary, useRepQueue, type PanelIdentity } from '../lib/panel-data'
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
import { ScriptCard } from '../ui/ScriptCard'
import { Button } from '../../src/ui/Button'
import { EmptyState } from '../../src/ui/EmptyState'
import { Input } from '../../src/ui/Input'
import { ErrorState } from '../../src/ui/ErrorState'
import { LibrarySkeleton, QueueSkeleton, TargetSkeleton } from '../ui/Skeletons'
import { StaleChip } from '../ui/StaleChip'

let rootMounts = 0

export function getRootMounts() {
  return rootMounts
}

const TABS = [
  { to: '/queue', label: 'Queue' },
  { to: '/lead', label: 'Lead' },
  { to: '/library', label: 'Library' },
  { to: '/settings', label: 'Settings' },
]

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

function OwnTarget({ identity }: { identity: PanelIdentity }) {
  const month = firstOfMonth()
  const { item, loading, error, reload } = useTarget(identity.clientId, identity.userId, month)
  const won = useOwnWonValue(identity.clientId, identity.userId, month)
  if (loading || won.loading) return <TargetSkeleton />
  if (error || won.error)
    return (
      <div role="alert" className="flex min-h-10 items-center gap-2 border-b border-border bg-danger-subtle px-3 py-2 text-xs text-danger">
        <CircleAlert aria-hidden size={14} strokeWidth={1.9} className="shrink-0" />
        <span className="min-w-0 flex-1">Your target could not be loaded.</span>
        <Button variant="ghost" size="sm" onClick={() => void reload()}>Retry</Button>
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

function LeadWorkspace({ identity, lead, onChanged }: { identity: PanelIdentity; lead: QueueItem; onChanged: () => void }) {
  const { stages } = useLeadStages(identity.clientId)
  const { items: taxonomy } = useObjectionTaxonomy(identity.clientId)
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
      refreshDetail()
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
  const visibleDetail = cachedDetail && detailPending ? { ...cachedDetail, lead: current } : detail

  useEffect(() => {
    if (detailPending || detailError) return
    setCachedDetail(null)
    setCachedAt(null)
    void cacheLeadDetail(cached(detail, new Date(), identity.clientId))
  }, [detail, detailError, detailPending, identity.clientId])
  const refreshDetail = () => {
    void Promise.all([memory.reload(), objections.reload(), calls.reload(), notes.reload()])
    onChanged()
  }
  const stageOptions = stages.map((stage) => ({ key: stage.stage_key, label: stage.label }))
  const taxonomyOptions = taxonomy.map((item) => ({ key: item.key, label: item.label }))

  return (
    <LeadScreen
      detail={visibleDetail}
      viewerId={identity.userId}
      pending={detailPending && !cachedDetail}
      workspace={(
        <div className="space-y-3 px-3 pt-3">
          {cachedAt && detailPending && (
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
          <VoiceFlow clientId={identity.clientId} leadId={current.lead_id} onSaved={refreshDetail} />
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
                  else { setCurrent((item) => ({ ...item, status })); onChanged() }
                })
              }}
              onFollowUpChange={setFollowUp}
              onSaveNote={(body) => {
                setBusy(true)
                void addNote(identity.clientId, { conversation_id: null, lead_id: current.lead_id, author: identity.userId, body }).then((result) => {
                  setBusy(false)
                  setMessage(result.ok ? 'Note saved.' : result.message ?? 'Note could not be saved.')
                  if (result.ok) refreshDetail()
                })
              }}
              onObjection={(key) => {
                const item = taxonomy.find((candidate) => candidate.key === key)
                if (!item) return
                setBusy(true)
                void logObjection({ clientId: identity.clientId, contactId: current.contact_id, leadId: current.lead_id, taxonomyId: item.id, source: 'crm', actorId: identity.userId }).then((result) => {
                  setBusy(false)
                  setMessage(result.ok ? 'Objection logged.' : result.message)
                  if (result.ok) refreshDetail()
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

function LibraryScreen({ clientId }: { clientId: string }) {
  const { scripts, loading, error, reload, staleAt } = useCachedScriptLibrary(clientId)
  if (loading) return <main><LibrarySkeleton /></main>
  if (error)
    return (
      <main>
        <ErrorState title="Couldn’t load the library" body={error} onRetry={() => void reload()} />
      </main>
    )
  if (scripts.length === 0) return <EmptyState title="No scripts yet" body="Your manager’s approved scripts will appear here." />
  return <main className="space-y-3 p-3">{staleAt && <StaleChip fetched_at={staleAt} />}{scripts.map((script) => {
    const current = script.current
    const body = current?.body?.paragraphs.map((p) => `${p.before}${p.highlight ?? ''}${p.after ?? ''}`).join('\n\n') ?? 'No approved copy yet.'
    return <ScriptCard key={script.taxonomyId} title={script.taxonomyLabel} body={body} versionLabel={current ? `v${current.version} · ${current.status}` : undefined} />
  })}</main>
}

function PanelRoutes({ identity }: { identity: PanelIdentity }) {
  const navigate = useNavigate()
  const queue = useRepQueue(identity)
  const [selected, setSelected] = useState<QueueItem | null>(null)
  return (
    <Routes>
      <Route path="/queue" element={queue.loading
        ? <QueueSkeleton />
        : queue.error && queue.items.length === 0
          ? <ErrorState title="Couldn’t load your queue" body="Check your connection, then retry." onRetry={() => void queue.reload()} />
          : <QueueScreen items={queue.items} staleAt={queue.staleAt} target={<OwnTarget identity={identity} />} onNext={(item) => { setSelected(item); navigate('/lead') }} onOpenLead={(item) => { setSelected(item); navigate('/lead') }} />}
      />
      <Route path="/lead" element={selected
        ? <LeadWorkspace identity={identity} lead={selected} onChanged={() => void queue.reload()} />
        : <EmptyState title="Open a lead from your queue" body="Choose Queue below, then pick the next conversation." />}
      />
      <Route path="/library" element={<LibraryScreen clientId={identity.clientId} />} />
      <Route path="/settings" element={<SettingsScreen />} />
    </Routes>
  )
}

export function AppShell({ identity }: { identity: PanelIdentity }) {
  useEffect(() => {
    rootMounts += 1
  }, [])

  return (
    <MemoryRouter initialEntries={['/queue']}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--canvas)', color: 'var(--fg)' }}>
        <main style={{ minHeight: 0, flex: 1, overflowY: 'auto' }}>
          <PanelRoutes identity={identity} />
        </main>
        <nav style={{ display: 'flex', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
          {TABS.map((tab) => (
            <NavLink key={tab.to} to={tab.to}>
              {({ isActive }) => (
                <span style={{ ...navLinkStyle(isActive), width: '100%' }}>{tab.label}</span>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </MemoryRouter>
  )
}

type AuthState = 'checking' | 'signed_in' | 'signed_out' | 'refresh_failed'

export default function App() {
  const [state, setState] = useState<AuthState>('checking')
  const [message, setMessage] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [identity, setIdentity] = useState<PanelIdentity | null>(null)

  useEffect(() => {
    let alive = true
    void chrome.storage.local.get(AUTH_NEEDS_SIGNIN_KEY).then(async (stored) => {
      if (!alive) return
      if (stored[AUTH_NEEDS_SIGNIN_KEY] === true) {
        setState('refresh_failed')
        return
      }
      const result = await checkPanelSession()
      if (!alive) return
      if (result.ok) {
        const nextIdentity = await loadPanelIdentity(result.session)
        if (!nextIdentity) {
          setMessage('No client membership is available for this account.')
          setState('signed_out')
          return
        }
        setIdentity(nextIdentity)
        setState('signed_in')
        void drainOutbox()
      } else {
        setMessage(result.message ?? null)
        setState(result.reason)
      }
    })
    const { data } = panelSupabase.auth.onAuthStateChange((event, session) => {
      if (!alive || event === 'INITIAL_SESSION') return
      if (!session) {
        setIdentity(null)
        setState('signed_out')
        return
      }
      void loadPanelIdentity(session).then((nextIdentity) => {
        setIdentity(nextIdentity)
        setState(nextIdentity ? 'signed_in' : 'signed_out')
      })
    })
    const storageChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'local' && changes[AUTH_NEEDS_SIGNIN_KEY]?.newValue === true) {
        setState('refresh_failed')
      }
    }
    chrome.storage.onChanged.addListener(storageChanged)
    const online = () => {
      void checkPanelSession().then((result) => {
        if (result.ok) void drainOutbox()
      })
    }
    window.addEventListener('online', online)
    return () => {
      alive = false
      data.subscription.unsubscribe()
      chrome.storage.onChanged.removeListener(storageChanged)
      window.removeEventListener('online', online)
    }
  }, [])

  async function signIn(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setMessage(null)
    const { error } = await panelSupabase.auth.signInWithPassword({ email, password })
    setSubmitting(false)
    if (error) setMessage(error.message)
    else await chrome.storage.local.remove(AUTH_NEEDS_SIGNIN_KEY)
  }

  // Session check is fast and the panel always lands on the queue, so show the
  // queue's own frame rather than a word on an empty panel.
  if (state === 'checking') return <main aria-busy="true"><QueueSkeleton /></main>
  if (state === 'signed_in' && identity) return <AppShell identity={identity} />

  return (
    <main className="grid gap-4 p-5">
      <h1 className="text-lg font-semibold tracking-[-0.035em] text-fg">
        {state === 'refresh_failed' ? 'Sign in again' : 'Sign in'}
      </h1>
      {state === 'refresh_failed' && (
        <p role="alert" className="flex items-start gap-2 rounded-md bg-warn-subtle px-3 py-2 text-xs leading-relaxed text-warn">
          <CircleAlert aria-hidden size={14} strokeWidth={1.9} className="mt-0.5 shrink-0" />
          Your session could not be refreshed. Offline changes are still safely queued.
        </p>
      )}
      {message && (
        <p role="alert" className="rounded-md bg-danger-subtle px-3 py-2 text-xs leading-relaxed text-danger">{message}</p>
      )}
      <form onSubmit={signIn} className="grid gap-3">
        <label className="grid gap-1">
          <span className="label-caps">Email</span>
          <Input required type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label className="grid gap-1">
          <span className="label-caps">Password</span>
          <Input required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        <Button type="submit" className="mt-1 min-h-11 w-full" loading={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </main>
  )
}
