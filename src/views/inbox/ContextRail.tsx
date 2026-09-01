import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Sparkles, Pause, Play, Trash2, ExternalLink } from 'lucide-react'
import type { QueueItem } from '../../lib/inbox-data'
import { parseFacts } from '../../lib/inbox-data'
import { useLeadStages, useFollowUps, moveLeadStage } from '../../lib/leads-data'
import { useConvLead, useNotes, useTeammates, teammateLabel } from '../../lib/crm-data'
import { setBotPaused, assignConversation, addFollowUp, addNote, deleteNote } from '../../lib/crm-actions'
import { fetchInsight } from '../../lib/api'
import type { Insight } from '../../lib/api'
import { useAuth } from '../../auth/AuthProvider'
import { Avatar } from '../../ui/Avatar'
import { FactCard } from '../../ui/agent/FactCard'
import { ChannelIcon } from '../../ui/ChannelIcon'
import { Chip } from '../../ui/Chip'
import { Button } from '../../ui/Button'
import { formatINR } from '../../ui/formatMoney'
import { getWhatsAppUrl, formatPhone } from '../../lib/phone'

// SA-05 context rail — the Workbench Inbox right rail rebuilt in the Board
// language, for manager AND rep alike (capability differences are RLS's job,
// not this file's). Everything here is REAL:
//   pause/resume bot · lead stage move · follow-up quick add · notes CRUD
//   (direct PostgREST under RLS, the lane Workbench already uses) and the AI
//   summary via hub-service /api/insights (server-enforced membership).
// A denied write reverts and says so — never a silent success.

const capsStyle = {
  fontWeight: 'var(--weight-caps)',
  letterSpacing: 'var(--tracking-caps)',
} as const

const monoStyle = { fontFamily: 'var(--font-mono)' } as const

const WINDOW_MS = 24 * 3_600_000
const IG_HUMAN_WINDOW_MS = 7 * 24 * 3_600_000

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="label-caps text-fg-subtle">
      {children}
    </h3>
  )
}

export function ContextRail({
  clientId,
  item,
  onChanged,
  onUseDraft,
}: {
  clientId: string
  item: QueueItem
  onChanged: () => void
  /** Push the AI draft reply into the composer. */
  onUseDraft: (text: string) => void
}) {
  const { session } = useAuth()
  const userId = session?.user?.id ?? null
  const name = item.contact?.profile_name ?? item.contact?.external_id ?? 'Unknown contact'
  const memoryFacts = useMemo(() => parseFacts(item), [item])

  // --- bot pause/resume ------------------------------------------------
  const [pauseBusy, setPauseBusy] = useState(false)
  const [pauseErr, setPauseErr] = useState<string | null>(null)
  const togglePause = async () => {
    setPauseBusy(true)
    setPauseErr(null)
    const res = await setBotPaused(clientId, item.id, !item.bot_paused)
    setPauseBusy(false)
    if (!res.ok) {
      setPauseErr(
        res.reason === 'denied'
          ? "You don't have permission to change the bot here."
          : "That didn't go through. Try again.",
      )
      return
    }
    onChanged()
  }

  // --- label (assignment) ----------------------------------------------
  // Joyal's "easy label option": one select, right on the chat. RLS decides
  // who may actually write it; a denied write reverts with a message.
  const { items: teammates } = useTeammates(clientId)
  const [labelBusy, setLabelBusy] = useState(false)
  const [labelErr, setLabelErr] = useState(false)
  const changeLabel = async (value: string) => {
    setLabelBusy(true)
    setLabelErr(false)
    const res = await assignConversation(clientId, item.id, value === '' ? null : value)
    setLabelBusy(false)
    if (!res.ok) {
      setLabelErr(true)
      return
    }
    onChanged()
  }

  // --- lead + stage ----------------------------------------------------
  const { lead, reload: reloadLead } = useConvLead(clientId, item.contact_id)
  const { stages } = useLeadStages(clientId)
  const [stageErr, setStageErr] = useState(false)
  const changeStage = async (stageId: string) => {
    if (!lead) return
    setStageErr(false)
    const res = await moveLeadStage(clientId, lead.id, stageId)
    if (!res.ok) {
      setStageErr(true)
      return
    }
    void reloadLead()
  }

  // --- follow-up -------------------------------------------------------
  const { items: followUps, reload: reloadFollowUps } = useFollowUps(clientId)
  const pendingFu = useMemo(
    () =>
      followUps.find((f) =>
        lead ? f.lead_id === lead.id : f.contact_id === item.contact_id,
      ) ?? null,
    [followUps, lead, item.contact_id],
  )
  const [fuNote, setFuNote] = useState('')
  const [fuBusy, setFuBusy] = useState(false)
  const [fuErr, setFuErr] = useState(false)
  const [fuOpen, setFuOpen] = useState(false)
  const quickAdd = async (hours: number) => {
    const note = fuNote.trim()
    if (!note || fuBusy) return
    setFuBusy(true)
    setFuErr(false)
    const res = await addFollowUp(clientId, {
      contact_id: item.contact_id,
      lead_id: lead?.id ?? null,
      conversation_id: item.id,
      due_at: new Date(Date.now() + hours * 3_600_000).toISOString(),
      note,
      channel: item.contact?.channel === 'instagram' ? 'instagram' : 'whatsapp',
      created_by: userId,
    })
    setFuBusy(false)
    if (!res.ok) {
      setFuErr(true)
      return
    }
    setFuNote('')
    setFuOpen(false)
    void reloadFollowUps()
  }

  // --- AI summary ------------------------------------------------------
  const [insight, setInsight] = useState<Insight | null>(null)
  const [insightState, setInsightState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [insightErr, setInsightErr] = useState('')
  useEffect(() => {
    setInsight(null)
    setInsightState('idle')
  }, [item.id])

  // Issue #18: the server persists the summary in conversations.rolling_summary
  // (summary_upto = the cut-off it covers), but the panel only ever generated
  // on demand and never read the saved text back — so a reopened thread looked
  // empty. Hydrate from the column on thread open; fall back to on-demand
  // generation only when it is null or stale (a customer message newer than
  // the summary covers).
  const persistedSummary =
    item.rolling_summary && item.rolling_summary.trim() ? item.rolling_summary : null
  const summaryStale =
    !!persistedSummary &&
    !!item.summary_upto &&
    !!item.last_customer_message_at &&
    new Date(item.last_customer_message_at).getTime() > new Date(item.summary_upto).getTime()
  const summaryFresh = !!persistedSummary && !summaryStale

  // Handover moment: the bot stepped aside and a human is picking this up —
  // fetch the summary unprompted, once per conversation (it's the exact moment
  // "don't make the customer repeat themselves" is decided). Ordinary threads
  // keep the button; every LLM call costs money. A fresh persisted summary
  // already answers the panel, so skip the regeneration there too (#18).
  const autoFetched = useRef<string | null>(null)
  useEffect(() => {
    if (
      item.bot_paused &&
      !item.escalation_resolved &&
      !summaryFresh &&
      autoFetched.current !== item.id
    ) {
      autoFetched.current = item.id
      void getInsight()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire on thread change only
  }, [item.id, item.bot_paused, item.escalation_resolved])
  const getInsight = async () => {
    setInsightState('loading')
    const res = await fetchInsight(item.id)
    if (res.kind === 'ok') {
      setInsight(res.data)
      setInsightState('idle')
      return
    }
    setInsightState('error')
    setInsightErr(
      res.kind === 'llm_failed'
        ? "The summary couldn't be generated. Try again."
        : res.kind === 'no_key'
          ? 'Paste your workspace access key in the composer first.'
          : res.kind === 'forbidden'
            ? "Your role can't request summaries here."
            : 'Summary service is unreachable. Try again shortly.',
    )
  }

  // --- notes -----------------------------------------------------------
  const { items: notes, reload: reloadNotes } = useNotes(clientId, { conversationId: item.id })
  const [noteDraft, setNoteDraft] = useState('')
  const [noteErr, setNoteErr] = useState(false)
  const submitNote = async () => {
    const body = noteDraft.trim()
    if (!body) return
    setNoteErr(false)
    const res = await addNote(clientId, {
      conversation_id: item.id,
      lead_id: lead?.id ?? null,
      author: session?.user?.email ?? null,
      body,
    })
    if (!res.ok) {
      setNoteErr(true)
      return
    }
    setNoteDraft('')
    void reloadNotes()
  }

  // --- service window (UX mirror only; the real gate lives server-side) --
  const isIG = item.contact?.channel === 'instagram'
  const sinceLast = item.last_customer_message_at
    ? Date.now() - new Date(item.last_customer_message_at).getTime()
    : Infinity
  const windowClosed = sinceLast > (isIG ? IG_HUMAN_WINDOW_MS : WINDOW_MS)


  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto">
      {/* Identity */}
      <div className="border-b border-border px-4 py-4">
        <div className="flex items-center gap-3">
          <Avatar name={name} profile={item.contact?.profile} size="lg" />
          <div className="min-w-0">
            <div className="truncate text-md font-semibold text-fg">{name}</div>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
              <ChannelIcon channel={item.contact?.channel ?? null} size={13} />
              <span className="tnum truncate text-xs text-fg-subtle" style={monoStyle}>
                {formatPhone(item.contact?.external_id)}
              </span>
              {item.contact?.channel === 'whatsapp' && item.contact?.external_id && (
                <a
                  href={getWhatsAppUrl(item.contact.external_id) ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open in WhatsApp"
                  aria-label="Open in WhatsApp"
                  className="inline-flex items-center gap-1 rounded border border-border bg-surface px-1.5 py-0.5 text-3xs font-semibold text-fg-muted transition-colors hover:border-[#25D366]/50 hover:bg-[#25D366]/10 hover:text-fg"
                >
                  <ExternalLink aria-hidden size={9} />
                  <span>WhatsApp</span>
                </a>
              )}
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Chip tone={item.status === 'open' ? 'accent' : 'neutral'}>{item.status}</Chip>
          {item.bot_paused ? (
            <Chip tone={item.escalation_resolved ? 'warn' : 'danger'}>
              {item.escalation_resolved ? 'Bot paused' : 'Needs human'}
            </Chip>
          ) : (
            <Chip tone="success">Bot active</Chip>
          )}
          {item.contact?.is_opted_out && <Chip tone="danger">Opted out</Chip>}
        </div>
        <div className="mt-3">
          <Button variant="secondary" size="sm" onClick={() => void togglePause()} disabled={pauseBusy}>
            {item.bot_paused ? (
              <>
                <Play aria-hidden size={13} strokeWidth={2} /> Resume bot
              </>
            ) : (
              <>
                <Pause aria-hidden size={13} strokeWidth={2} /> Pause bot
              </>
            )}
          </Button>
          {pauseErr && <p className="mt-1.5 text-2xs text-danger">{pauseErr}</p>}
        </div>
        {/* Label — which employee owns this chat. */}
        <div className="mt-3">
          <label className="block">
            <span className="mb-1 block text-2xs text-fg-subtle uppercase" style={capsStyle}>
              Labeled to
            </span>
            <select
              value={item.assigned_to ?? ''}
              onChange={(e) => void changeLabel(e.target.value)}
              disabled={labelBusy}
              aria-label={`Label ${name} to an employee`}
              className="h-9 w-full rounded-md border border-border bg-surface px-2 text-sm text-fg hover:border-border-strong disabled:opacity-60"
            >
              <option value="">Unlabeled</option>
              {userId && <option value={userId}>Me</option>}
              {teammates
                .filter((t) => t.user_id !== userId)
                .map((t) => (
                  <option key={t.user_id} value={t.user_id}>
                    {teammateLabel(t)}
                  </option>
                ))}
              {/* Assigned to someone the roster can't see — keep it selectable
                  so the select doesn't lie. */}
              {item.assigned_to &&
                item.assigned_to !== userId &&
                !teammates.some((t) => t.user_id === item.assigned_to) && (
                  <option value={item.assigned_to}>
                    External assignee ({item.assigned_to.slice(0, 4)})
                  </option>
                )}
            </select>
          </label>
          {labelErr && (
            <p className="mt-1.5 text-2xs text-danger">
              Couldn't change the label — you may not have permission.
            </p>
          )}
        </div>

        {windowClosed && (
          <p className="mt-3 rounded-md bg-surface-sunk px-2.5 py-2 text-2xs text-fg-muted">
            {isIG
              ? 'Instagram reply window closed (7 days since their last message).'
              : 'WhatsApp 24-hour reply window closed. It reopens when the customer messages again.'}
          </p>
        )}
      </div>

      {/* Lead */}
      <div className="space-y-2 border-b border-border px-4 py-4">
        <div className="flex items-baseline justify-between">
          <SectionTitle>Lead</SectionTitle>
          <Link to="/crm" className="text-2xs text-fg-muted hover:text-fg">
            CRM →
          </Link>
        </div>
        {lead ? (
          <>
            <select
              value={lead.stage_id}
              onChange={(e) => void changeStage(e.target.value)}
              aria-label={`Stage for ${name}`}
              className="h-9 w-full rounded-md border border-border bg-surface px-2 text-sm text-fg hover:border-border-strong"
            >
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            {stageErr && (
              <p className="text-2xs text-danger">
                That stage move didn't go through. You may not have permission on this lead.
              </p>
            )}
            <div className="flex items-center gap-2.5">
              {lead.est_value != null && (
                <span className="tnum text-xs text-fg-muted" style={monoStyle}>
                  {formatINR(Number(lead.est_value))}
                </span>
              )}
            </div>
          </>
        ) : (
          <p className="text-xs text-fg-subtle">No open lead for this contact.</p>
        )}
      </div>

      {/* Follow-up */}
      <div className="space-y-2 border-b border-border px-4 py-4">
        <SectionTitle>Follow-up</SectionTitle>
        {pendingFu && (
          <div className="flex items-center justify-between gap-2 text-xs text-fg-muted">
            <p className="min-w-0 flex-1 truncate">
              <span
                className={[
                  'tnum mr-2',
                  new Date(pendingFu.due_at).getTime() < Date.now() ? 'text-danger font-medium' : 'text-fg-subtle',
                ].join(' ')}
                style={monoStyle}
              >
                {new Date(pendingFu.due_at).toLocaleString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
              {pendingFu.note}
            </p>
            {new Date(pendingFu.due_at).getTime() < Date.now() && (
              <span className="shrink-0 rounded bg-danger-subtle px-1.5 py-0.5 text-3xs font-semibold text-danger">
                Overdue
              </span>
            )}
          </div>
        )}
        {fuOpen ? (
          <>
            <input
              value={fuNote}
              onChange={(e) => setFuNote(e.target.value)}
              placeholder="What to do"
              aria-label="Follow-up note"
              className="h-9 w-full rounded-md border border-border bg-surface px-2.5 text-sm text-fg placeholder:text-fg-subtle hover:border-border-strong"
            />
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ['In 3h', 3],
                  ['Tomorrow', 24],
                  ['In 3 days', 72],
                  ['In a week', 168],
                ] as const
              ).map(([label, h]) => (
                <button
                  key={h}
                  onClick={() => void quickAdd(h)}
                  disabled={!fuNote.trim() || fuBusy}
                  className="rounded-pill border border-border px-2.5 py-1 text-2xs font-semibold text-fg-muted hover:border-border-strong hover:text-fg disabled:opacity-50"
                >
                  {label}
                </button>
              ))}
            </div>
            {fuErr && <p className="text-2xs text-danger">Couldn't save the follow-up. Try again.</p>}
          </>
        ) : (
          <Button variant="secondary" size="sm" onClick={() => setFuOpen(true)}>
            {pendingFu ? 'Add another' : 'Set follow-up'}
          </Button>
        )}
      </div>

      {/* Customer memory — wired to real per-conversation extracted facts (sales-app#21 S2) */}
      <div className="space-y-2 border-b border-border px-4 py-4">
        <div className="flex items-center justify-between">
          <SectionTitle>Customer memory</SectionTitle>
        </div>
        {memoryFacts.length === 0 ? (
          <p className="text-xs text-fg-subtle">No customer facts extracted yet.</p>
        ) : (
          <div className="space-y-2">
            {memoryFacts.slice(0, 5).map((f) => (
              <FactCard key={f.id} fact={f} compact />
            ))}
          </div>
        )}
      </div>

      {/* AI summary */}
      <div className="space-y-2 border-b border-border px-4 py-4">
        <SectionTitle>AI summary</SectionTitle>
        {insight ? (
          <>
            {insight.summary && <p className="text-xs leading-relaxed text-fg">{insight.summary}</p>}
            <div>
              <div className="text-2xs text-fg-subtle uppercase" style={capsStyle}>
                Next best action
              </div>
              <p className="mt-1 text-xs text-fg">{insight.next_action}</p>
            </div>
            {insight.draft_reply && (
              <div className="rounded-md border border-border bg-surface-sunk p-2.5">
                <p className="text-xs text-fg-muted">{insight.draft_reply}</p>
                <button
                  onClick={() => onUseDraft(insight.draft_reply)}
                  className="mt-2 text-2xs font-semibold text-accent hover:underline"
                >
                  Use draft
                </button>
              </div>
            )}
          </>
        ) : summaryFresh ? (
          <p className="text-xs leading-relaxed text-fg">{persistedSummary}</p>
        ) : (
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void getInsight()}
              disabled={insightState === 'loading'}
            >
              <Sparkles aria-hidden size={13} strokeWidth={2} />
              {insightState === 'loading' ? 'Summarising' : 'Summarise conversation'}
            </Button>
            {insightState === 'error' && <p className="text-2xs text-danger">{insightErr}</p>}
          </>
        )}
      </div>

      {/* Notes */}
      <div className="space-y-2 px-4 py-4">
        <SectionTitle>Notes (internal)</SectionTitle>
        {notes.length === 0 && <p className="text-xs text-fg-subtle">No notes yet.</p>}
        {notes.map((n) => (
          <div key={n.id} className="group flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-fg">{n.body}</p>
              <p className="tnum mt-0.5 text-2xs text-fg-subtle" style={monoStyle}>
                {new Date(n.created_at).toLocaleString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                {n.author ? ` · ${n.author}` : ''}
              </p>
            </div>
            <button
              onClick={() => void deleteNote(clientId, n.id).then(() => void reloadNotes())}
              aria-label="Delete note"
              className="rounded-sm p-1 text-fg-subtle opacity-0 group-hover:opacity-100 hover:bg-surface-sunk hover:text-danger"
            >
              <Trash2 aria-hidden size={13} strokeWidth={1.75} />
            </button>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <input
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submitNote()
            }}
            placeholder="Add internal note"
            aria-label="Add internal note"
            className="h-9 min-w-0 flex-1 rounded-md border border-border bg-surface px-2.5 text-sm text-fg placeholder:text-fg-subtle hover:border-border-strong"
          />
          <Button variant="secondary" size="sm" onClick={() => void submitNote()} disabled={!noteDraft.trim()}>
            Add
          </Button>
        </div>
        {noteErr && <p className="text-2xs text-danger">Couldn't save the note. Try again.</p>}
      </div>
    </div>
  )
}
