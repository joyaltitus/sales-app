import { useEffect, useRef, useState } from 'react'
import { Bot, ChevronRight, Send, ShieldCheck, Sparkles, WandSparkles } from 'lucide-react'
import { Button } from '../../ui/Button'
import { AnchorChip, ToolProgress } from '../../ui/agent/primitives'
import { ApprovalCard } from '../../ui/agent/ApprovalCard'
import { VoiceButton } from '../../ui/agent/VoiceButton'
import {
  approveChecklist,
  sendAgentChat,
  useAgentActivity,
  type Approval,
  type Capability,
  type ChecklistItem,
  type StepOutcome,
} from '../../lib/agent-chat'
import { hasConfiguredGatewayKey } from '../../lib/gateway-key'
import { useClient } from '../../shell/ClientProvider'

// The AI Sales Agent surface (B-UI): wired to POST /api/agent-chat + POST
// /api/agent-approve. Every run ends in tool receipts and, when the model
// proposed a write, one batched checklist — approving anything only ever
// happens through that second request (C-R5), never inline.

const AGENT_STARTERS = [
  'Summarise this customer',
  'Draft a reply about instalments',
  'Which leads should I revive today?',
]

type PanelMsg =
  | { id: string; role: 'user'; text: string }
  | { id: string; role: 'agent'; text: string }
  | { id: string; role: 'tool'; tool: string; status: StepOutcome['status']; summary: string }
  | { id: string; role: 'checklist'; sessionId: string; items: ChecklistItem[]; decisions: Record<string, 'approved' | 'cancelled'>; submitted: boolean; error: string | null }
  | { id: string; role: 'capabilities'; capabilities: Capability[] }
  | { id: string; role: 'notice'; tone: 'muted' | 'danger'; text: string }

function Msg({ m, onDecide, onSubmit }: {
  m: PanelMsg
  onDecide: (checklistId: string, itemId: string, decision: 'approved' | 'cancelled') => void
  onSubmit: (checklistId: string) => void
}) {
  if (m.role === 'tool') return <ToolProgress tool={m.tool} status="done" summary={m.summary} />
  if (m.role === 'notice') {
    return <p className={['text-2xs', m.tone === 'danger' ? 'text-danger' : 'text-fg-muted'].join(' ')}>{m.text}</p>
  }
  if (m.role === 'capabilities') {
    return (
      <div className="rounded-lg border border-border bg-surface p-3 shadow-elev-1">
        <p className="label-caps mb-2">I couldn't turn that into a plan — try one of these instead</p>
        <div className="grid gap-1.5">
          {m.capabilities.map((c) => (
            <div key={c.tool} className="flex items-center gap-2 text-xs text-fg-muted">
              <ChevronRight aria-hidden size={12} className="shrink-0 text-fg-subtle" />
              <span className="font-medium text-fg">{c.tool.replaceAll('_', ' ')}</span>
              <span className="truncate">— {c.description}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }
  if (m.role === 'checklist') {
    const pendingCount = m.items.filter((i) => !m.decisions[i.id]).length
    const decidedAny = Object.keys(m.decisions).length > 0
    return (
      <div className="space-y-2">
        {m.items.map((item) => (
          <ApprovalCard key={item.id} item={item} decision={m.decisions[item.id] ?? null} onDecide={(id, d) => onDecide(m.id, id, d)} />
        ))}
        {!m.submitted && decidedAny && (
          <Button size="sm" onClick={() => onSubmit(m.id)}>
            Submit {pendingCount > 0 ? `(${pendingCount} still undecided will be cancelled)` : 'decisions'}
          </Button>
        )}
        {m.error && <p className="text-2xs text-danger">{m.error}</p>}
      </div>
    )
  }
  const user = m.role === 'user'
  return (
    <div className={['flex', user ? 'justify-end' : 'justify-start'].join(' ')}>
      <p
        className={[
          'max-w-[88%] rounded-lg px-3.5 py-2.5 text-sm leading-relaxed break-words shadow-elev-1',
          user ? 'rounded-br-xs bg-accent text-accent-fg' : 'rounded-bl-xs border border-border bg-surface-raised text-fg',
        ].join(' ')}
      >
        {m.text}
      </p>
    </div>
  )
}

/** Human line for every non-ok HubResult kind (mirrors ContextRail.tsx / Composer.tsx). */
function explainFailure(kind: string): string {
  switch (kind) {
    case 'no_key':
      return hasConfiguredGatewayKey() ? 'Access key rejected. Contact your admin.' : 'Paste your workspace access key first.'
    case 'no_session':
      return 'Your session expired — sign in again.'
    case 'unauthorized':
      return 'Access key or session is invalid.'
    case 'forbidden':
      return "Your role can't use the agent."
    case 'paused':
      return 'The agent is paused for this workspace.'
    case 'bad_request':
      return 'That request was malformed.'
    default:
      return 'The agent is unreachable. Try again shortly.'
  }
}

export function AgentPanel() {
  const { activeClient } = useClient()
  const clientId = activeClient?.id ?? null
  const [thread, setThread] = useState<PanelMsg[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [input, setInput] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  const { rows: activity } = useAgentActivity()

  const run = async (text: string) => {
    if (sending) return
    setSending(true)
    setInput('')
    setThread((t) => [...t, { id: `u-${Date.now()}`, role: 'user', text }])

    const res = await sendAgentChat({
      text,
      sessionId,
      clientId,
      anchorContactId: null,
      anchorLeadId: null,
    })

    if (res.kind !== 'ok') {
      setThread((t) => [...t, { id: `n-${Date.now()}`, role: 'notice', tone: 'danger', text: explainFailure(res.kind) }])
      setSending(false)
      return
    }

    const body = res.data
    if (!body.ok) {
      setThread((t) => [...t, { id: `c-${Date.now()}`, role: 'capabilities', capabilities: body.capabilities }])
      setSending(false)
      return
    }

    setSessionId(body.session_id)
    const next: PanelMsg[] = []
    if (body.session_closed) {
      next.push({ id: `n-${Date.now()}-closed`, role: 'notice', tone: 'muted', text: `Started a new session${body.session_closed_reason ? ` (${body.session_closed_reason.replaceAll('_', ' ')})` : ''}.` })
    }
    for (const step of body.steps) {
      next.push({
        id: `t-${step.id}`,
        role: 'tool',
        tool: step.tool.replaceAll('_', ' '),
        status: step.status,
        summary: step.status === 'executed' ? `${step.rows?.length ?? 0} result${step.rows?.length === 1 ? '' : 's'}${step.truncated ? ' (truncated)' : ''}` : (step.error ?? step.status),
      })
    }
    next.push({ id: `a-${Date.now()}`, role: 'agent', text: body.reply })
    if (body.checklist.length > 0) {
      next.push({ id: `cl-${Date.now()}`, role: 'checklist', sessionId: body.session_id, items: body.checklist, decisions: {}, submitted: false, error: null })
    }
    setThread((t) => [...t, ...next])
    setSending(false)
  }

  const onDecide = (checklistId: string, itemId: string, decision: 'approved' | 'cancelled') => {
    setThread((t) =>
      t.map((m) => (m.id === checklistId && m.role === 'checklist' ? { ...m, decisions: { ...m.decisions, [itemId]: decision } } : m)),
    )
  }

  const onSubmit = async (checklistId: string) => {
    const msg = thread.find((m) => m.id === checklistId)
    if (!msg || msg.role !== 'checklist') return
    const approvals: Approval[] = Object.entries(msg.decisions)
      .filter(([, d]) => d === 'approved')
      .map(([id]) => {
        const item = msg.items.find((i) => i.id === id)!
        return { id, tier: item.tier as Approval['tier'] }
      })
    const res = await approveChecklist(msg.sessionId, clientId, approvals)
    if (res.kind !== 'ok') {
      setThread((t) => t.map((m) => (m.id === checklistId && m.role === 'checklist' ? { ...m, error: explainFailure(res.kind) } : m)))
      return
    }
    const body = res.data
    setThread((t) =>
      t.map((m) =>
        m.id === checklistId && m.role === 'checklist'
          ? { ...m, submitted: true, items: body.ok ? body.items : m.items, error: body.ok ? null : (body.reason ?? body.code) }
          : m,
      ),
    )
  }

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [thread.length])

  return (
    <div className="flex h-full min-h-0 flex-col bg-canvas">
      <div className="border-b border-border bg-surface px-4 py-4">
        <div className="flex items-center gap-3">
          <span className="relative flex h-10 w-10 items-center justify-center rounded-lg bg-accent-subtle text-accent shadow-elev-1">
            <Bot aria-hidden size={19} />
            <span className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-pill border-2 border-surface bg-success" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-md font-semibold tracking-[-0.02em] text-fg">Sales copilot</h2>
            <p className="mt-0.5 text-2xs text-fg-muted">Prepares work, shows its plan, and acts only after you approve.</p>
          </div>
        </div>
        <div className="mt-3"><AnchorChip name="General" detail="No customer pinned to this session" /></div>
      </div>

      <div className="app-grid min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {thread.length === 0 ? (
          <>
            <div className="rounded-xl border border-border bg-[linear-gradient(145deg,var(--surface-raised),var(--accent-subtle))] p-4 shadow-elev-1">
              <WandSparkles aria-hidden size={20} className="text-accent" />
              <h3 className="mt-3 text-lg font-semibold tracking-[-0.025em] text-fg">I found work worth moving.</h3>
              <p className="mt-1 text-xs leading-relaxed text-fg-muted">Ask a question or pick a starter — every write shows its plan and waits for your approval.</p>
            </div>
            <div className="grid gap-2">
              {AGENT_STARTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => void run(s)}
                  className="group flex min-h-11 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-left text-xs font-medium text-fg shadow-elev-1 hover:border-border-strong hover:bg-surface-raised"
                >
                  <Sparkles aria-hidden size={13} className="shrink-0 text-accent" />
                  <span className="min-w-0 flex-1">{s}</span>
                </button>
              ))}
            </div>

            {activity.length > 0 && (
              <div className="rounded-lg border border-border bg-surface p-3 shadow-elev-1">
                <h3 className="label-caps mb-1.5">Recent agent activity</h3>
                {activity.map((a) => (
                  <div key={a.id} className="flex gap-2 border-b border-border py-2 last:border-0">
                    <ShieldCheck aria-hidden size={13} className="mt-0.5 shrink-0 text-success" />
                    <p className="text-xs leading-relaxed text-fg-muted">
                      <span className="font-medium text-fg">{a.tool.replaceAll('_', ' ')}</span> · {new Date(a.created_at).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          thread.map((m) => <Msg key={m.id} m={m} onDecide={onDecide} onSubmit={(id) => void onSubmit(id)} />)
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t border-border bg-surface-glass p-3 backdrop-blur-xl">
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (input.trim()) void run(input.trim())
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask the agent…"
            aria-label="Ask the agent"
            className="h-10 min-w-0 flex-1 rounded-md border border-border bg-surface-raised px-3 text-sm text-fg shadow-[var(--inset-highlight)] placeholder:text-fg-subtle hover:border-border-strong"
          />
          <VoiceButton onTranscript={(t) => void run(t)} />
          <Button type="submit" size="sm" className="h-10" disabled={sending} aria-label="Send">
            <Send aria-hidden size={16} />
          </Button>
        </form>
      </div>
    </div>
  )
}
